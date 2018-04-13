// Convert to a GeoJSON
var request = require("superagent");
var fs = require('fs');

exports.convert = (req, res, next) => {	
	if (!req.files.file || !req.files.file.name) {
      res.status(400).json({error: true, msg: 'No file provided'})
      return;
    }
	
	var data = req.files.file;
	var file_name = data.name.replace(".zip", ".json");
	
	request
		.post('http://ogre.adc4gis.com/convert')
		.field('sourceSrs', '')
		.field('targetSrs', '')
		.attach('upload', data.path)
		.end(function (er, res) {
			if (er) return console.error(er)
		
			fs.writeFile( "./public/maps/" + file_name, JSON.stringify(res.body), function(err) {
			if(err) {
				return console.log(err);
			}
			
			}); 
		});
  
	res.json({"message": "The file was saved as " + file_name});
};

// Get all GeoJSONs
exports.list = (req, res, next) => {
	const folder = './public/maps';

	fs.readdir(folder, (err, files) => {
		res.json({"files": files});
	})
};
