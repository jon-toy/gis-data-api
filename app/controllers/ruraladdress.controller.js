require('../../utils.js')();
var sheriff = require('./sheriff.controller.js');

// Convert to a GeoJSON
var superagent_request = require("superagent");
var fs = require('fs');
var redis = require('redis');
var redis_client = redis.createClient();

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
    var folder = __dirname + "/../../public/ruraladdress";

    var ret = {};
    ret.zones = [];
    fs.readdir(folder, (err, files) => {
		files.forEach(file => {
            if (file == ".DS_Store") return;

            var zone = {};
            zone.name = file.replace(".tsv", "");

            var stats = fs.statSync(folder + "/" + file);
            zone.lastModified = stats.mtime;

            ret.zones.push(zone);
        });

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
        
        var dir = __dirname + "/../../public/transportation/zones/" + folderName;
        
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }

        fs.writeFile(dir + "/" + fileName, JSON.stringify(res.body), function(err) {
            if(err) {
                return console.log(err);
            }
        }); 
    });
}

function handleEditHistory(fileName, file) {
    var dir = __dirname + "/../../public/ruraladdress/";

    fs.readFile(file.path, function read(err, data) {
        if (err) {
            throw err;
        }
        fs.writeFile(dir + "/" + fileName + ".tsv", data, (err) => {
            if(err) {
                return console.log(err);
            }

            sheriff.readEditHistoryIntoMemory(dir);
        });
    });
}

function handleRotation(fileName, file) {
    var dir = __dirname + "/../../public/ruraladdress/rotation/";

    fs.readFile(file.path, function read(err, data) {
        if (err) {
            throw err;
        }
        fs.writeFile(dir + "/" + fileName + ".tsv", data, (err) => {
            if(err) {
                return console.log(err);
            }

            sheriff.readRotationIntoMemory(dir);
        });
    });
}

exports.getMetaData = (req, res) => {
    var zoneFolder = __dirname + "/../../public/transportation/zones";

    var ret = [];
    fs.readdir(zoneFolder, (err, folders) => {
		folders.forEach(folder => {
            if (folder == ".DS_Store") return;

            var zone = {};
            zone.name = folder;
            zone.files = [];

            var files = fs.readdirSync(zoneFolder + "/" + folder);
            files.forEach(file => {

                var zoneFile = {};
                zoneFile.name = file;

                var stats = fs.statSync(zoneFolder + "/" + folder + "/" + file);
                zoneFile.lastModified = stats.mtime;
                zoneFile.creationDate = stats.ctime;
                zoneFile.size = stats.size;

                zone.files.push(zoneFile);
            });
            
            ret.push(zone);
        });

        res.send(ret);
    });
}