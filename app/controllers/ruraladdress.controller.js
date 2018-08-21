require('../../utils.js')();

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
    if (!req.files.markers || !req.files.markers.name ||
        !req.files.parcels || !req.files.parcels.name ||
        !req.files.roads || !req.files.roads.name) {

		res.status(400).json({error: true, msg: 'No file provided'})
		return;
      }
	  
	var password = req.body.password;
	
	if ( password != UPLOAD_PASSWORD ) return res.json({"message": "Invalid Password"});

    convertAndWrite(folderName, "markers.json", req.files.markers);
    convertAndWrite(folderName, "parcels.json", req.files.parcels);
    convertAndWrite(folderName, "roads.json", req.files.roads);

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