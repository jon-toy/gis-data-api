require('../../utils.js')();
var sheriff = require('./sheriff.controller.js');

// Convert to a GeoJSON
var superagent_request = require("superagent");
var fs = require('fs');
var redis = require('redis');
var redis_client = redis.createClient();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const UPLOAD_PASSWORD = 'apache_county_eggdrop1315';

// Take in a set of 3 files (Markers, Parcels, Roads) and store them on disk
exports.postZone = (req, res, next) => {	
    if (!req.body.zoneName) {
        res.status(400).json({error: true, msg: 'No Zone Name provided'})
		return;
    }

    return handleResponse(req, res, req.body.zoneName);
};

exports.putZone = (req, res, next) => {
    if (!req.params.zoneName) {
        res.status(400).json({error: true, msg: 'No Zone Name provided'})
		return;
    }

    return handleResponse(req, res, req.params.oneName);
};

exports.getZoneEditHistory = (req, res, next) => {
    if (!req.params.zoneName) {
        res.status(400).json({error: true, msg: 'No Zone Name provided'})
		return;
    }

    redis_client.get(ZONE_EDIT_HISTORY_PREFIX + req.params.zoneName, (err, result) => {

        // Convert from string to JSON
        result = JSON.parse(result);

        if (req.query.startDate) {
            var startDate = new Date(req.query.startDate);

            result = result.map(parcel => {
                parcel.edits = parcel.edits.filter(edit => {
                    editDate = new Date(edit.date);
                    return (editDate >= startDate); // Only show edits that meet are after this start date
                });
                return parcel;
            });

            result = result.filter(parcel => parcel.edits.length > 0); // Only show parcels that fit this criteria
        }

        if (req.query.endDate) {
            var endDate = new Date(req.query.endDate);

            result = result.map(parcel => {
                parcel.edits = parcel.edits.filter(edit => {
                    editDate = new Date(edit.date);
                    return (editDate <= endDate); // Only show edits that meet are before this end date
                });
                return parcel;
            });

            result = result.filter(parcel => parcel.edits.length > 0); // Only show parcels that fit this criteria
        }
        res.send(result);
    });
}

exports.getZoneRotations = (req, res, next) => {
    if (!req.params.zoneName) {
        res.status(400).json({error: true, msg: 'No Zone Name provided'})
		return;
    }

    redis_client.get(ZONE_ROTATION_PREFIX + req.params.zoneName, (err, result) => {

        // Convert from string to JSON
        result = JSON.parse(result);
        res.send(result);
    });
}

exports.getZonesEditHistory = (req, res) => {
    const prefix = 'gis-data-api/ruraladdress/';

    var params = { 
		Bucket: S3_BUCKET_NAME,
		Delimiter: '/',
		Prefix: prefix
	  }
	
	s3.listObjectsV2(params, (err, data) => {
        var ret = {};
        ret.zones = [];

        data.Contents.forEach(file => {
            var zone = {};
            zone.name = file.Key.replace(prefix, '').replace('.tsv', '');
            zone.lastModified = file.LastModified;
            ret.zones.push(zone);
        })

        res.send(ret);
    });
}

function handleResponse(req, res, folderName) {
    if (!req.files.markers.size > 0 &&
        !req.files.parcels.size > 0 &&
        !req.files.roads.size > 0 &&
        !req.files.text.size > 0 &&
        !req.files.history.size > 0 &&
        !req.files.rotation.size > 0) {

		res.status(400).json({error: true, msg: 'No file provided'})
		return;
      }
	  
	var password = req.body.password;
	
	if ( password != UPLOAD_PASSWORD ) return res.json({"message": "Invalid Password"});

    if (req.files.markers.size > 0) convertAndWrite(folderName, "markers.json", req.files.markers);
    if (req.files.parcels.size > 0) convertAndWrite(folderName, "parcels.json", req.files.parcels);
    if (req.files.roads.size > 0) convertAndWrite(folderName, "roads.json", req.files.roads);
    if (req.files.text.size > 0) convertAndWrite(folderName, "text.json", req.files.text);

    if (req.files.history.size > 0) handleEditHistory(folderName, req.files.history);
    if (req.files.rotation.size > 0) handleRotation(folderName, req.files.rotation);

    return res.json({"message": "Writing in directory " + folderName});
}

function convertAndWrite(folderName, fileName, data) {
    superagent_request
    .post('http://ogre.adc4gis.com/convert')
    .field('sourceSrs', '')
    .field('targetSrs', '')
    .attach('upload', data.path)
    .end(function (er, res) {
        if (er) return console.error(er)

        uploadJSONToS3("transportation/zones/" + folderName + "/" + fileName, JSON.stringify(res.body), function(err) {
            if(err) {
                return console.log(err);
            }
        });
    });
}

function handleEditHistory(fileName, file) {
    // Write to S3
    uploadFileToS3("ruraladdress/" + fileName + ".tsv", file, function(err, data) {
        if (!err)
            sheriff.readEditHistoryIntoMemory(file);
        else
            console.error(err);
    })
}

function handleRotation(fileName, file) {
     // Write to S3
     uploadFileToS3("ruraladdress/rotation" + fileName + ".tsv", file, function(err, data) {
        if (!err)
            sheriff.readRotationIntoMemory(file);
        else
            console.error(err);
    })
}

exports.getMetaData = (req, res) => {
    var zoneFolder = __dirname + "/../../public/transportation/zones";

    const zones_prefix = 'gis-data-api/transportation/zones/';
    var params = { 
		Bucket: S3_BUCKET_NAME,
	  }
    
    // Get all objects in a bucket
	s3.listObjectsV2(params, (err, data) => {
        var files = [];

        // Get all the files that are part of the zones folder
        data.Contents.forEach(object => {
            const key = object.Key;
            if (key.indexOf(zones_prefix) < 0) return;
           
            files.push(object);
        })

        var zones = [];

        // Get all unique zone names
        files.forEach(object => {
            let zone = object.Key.replace(zones_prefix, '');
            zone = zone.substring(0, zone.indexOf('/'));
            if (zones.indexOf(zone) < 0 ) zones.push(zone);
        });

        var ret = [];

        // For each zone, get all the files for it and create an object for the return object
        zones.forEach(zone => {
            var zoneRet = {}
            zoneRet.name = zone;
            zoneRet.files = [];
            // Get all the files for this zone
            files.filter(object => object.Key.indexOf(zones_prefix + zone) >= 0)
                // Create a file object for this zone
                .forEach(filteredObject => {
                    var zoneFile = {};
                    zoneFile.name = filteredObject.Key.replace(zones_prefix + zone + '/', '');
                    zoneFile.lastModified = filteredObject.LastModified;
                    zoneRet.files.push(zoneFile);
                })
            ret.push(zoneRet);
        })

        res.send(ret);
    });
}