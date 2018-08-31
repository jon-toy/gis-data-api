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

function handleResponse(req, res, folderName) {
    if (!req.files.markers.size > 0 &&
        !req.files.parcels.size > 0 &&
        !req.files.roads.size > 0 &&
        !req.files.text.size > 0 &&
        !req.files.history.size > 0) {

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

            sheriff.readEditHistoryIntoMemory(dir);;
        });
    });
}