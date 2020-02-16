require('../../utils.js')();

var fs = require('fs');
var redis = require('redis');
var redis_client = redis.createClient();

var edit_history_parcels = [];

const UPLOAD_PASSWORD = 'apache_county_eggdrop1315';
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.convertEditReport = (req, res, next) => {	
	return parseEditReportCsvFile(req, res, next, "sheriff");
};

function parseEditReportCsvFile(req, res, next, folder_name) 
{
	if (!req.files.file || !req.files.file.name) {
		res.status(400).json({error: true, msg: 'No file provided'})
		return;
	  }
	  
	var data = req.files.file;
	var password = req.body.password;
	
	if ( password != UPLOAD_PASSWORD ) return res.json({"message": "Invalid Password"});

	var file_name = __dirname + "/../../public/" + folder_name + "/" + EDIT_HISTORY_FILENAME;
	console.log("Uploaded sheriff edit history export. Saving as " + folder_name + "/" + data.name);

	// Save a copy to S3
	fs.readFile(data.path, 'utf8', function(err, contents) {
		uploadFileToS3("ruraladdress/" + EDIT_HISTORY_FILENAME, contents, function(err, data) {
			if (!err)
				exports.readEditHistoryIntoMemory(data);
			else
				console.error(err);
		})
	});

	// Load into memory
	exports.readEditHistoryIntoMemory(data.path);
	
	return res.json({"message": "The file was saved as " + file_name});
}

exports.readEditHistoryIntoMemory = (folder) => {
	var params = { 
		Bucket: S3_BUCKET_NAME,
		Delimiter: '/',
		Prefix: 'gis-data-api/ruraladdress/'
	  }
	
	s3.listObjectsV2(params, (err, data) => {
		for (var i = 0; i < data.Contents.length; i++) {
			// Skip rotation folder
			var file = data.Contents[i].Key.replace('gis-data-api/ruraladdress/', '');
			if (file.indexOf('rotation') >= 0) continue;
			
			var zone_edit_history_parcels = []
			var s3Stream = s3.getObject({ Bucket: S3_BUCKET_NAME, Key: data.Contents[i].Key }).createReadStream();
			readLines(s3Stream, file, (line) => {

				if ( line.indexOf('APN') >= 0 && line.indexOf('SITUS') >= 0 && line.indexOf('ROAD') >= 0 && line.indexOf('EDITS') >= 0 ) return;
				var account = {}; // Account object to hold the data we're about to read in
		
				var fields = line.split('\t');
				if ( fields[0] ) account.apn = fields[0]; else return;
				if ( fields[1] ) account.situs = fields[1]; else return;
				if ( fields[2] ) account.road = fields[2]; else return;
				if ( fields[3] ) account.owner = fields[3]; else return;
				if ( fields[4] ) {
					if (fields[4] != "NULL")
						account.remarks = fields[4]; 
					else
						account.remarks = "";
				} else return;
				
				account.edits = [];
				var index = 5;
				while ( index < fields.length && fields[index] != null && fields[index].length > 0 )
				{
					if ( fields[index] != '\r' ) {
						var edit = {};

						var text = fields[index]; 

						if (text.length > 10) {
							// Date string by default is (xx/xx/xx)
							// Length is 10
							var dateStringRaw = fields[index].substring(text.length - 10, text.length);

							var date = dateStringRaw.replace("(", "").replace(")", "");

							// Check and make sure this is a date
							//var dateRegex = '/(0[1-9]|1[012])[- \/.](0[1-9]|[12][0-9]|3[01])[- \/.]\d\d/g';
							var dateRegex = `[0-9][0-9]\/[0-9][0-9]\/[0-9][0-9]`;
							var result = date.match(dateRegex);
							if(result == null) {
								//console.log("Invalid Date: " + date);
							}
							else {
								// Remove from the text (xx/xx/xx)
								text = text.replace(dateStringRaw, "");
								edit.date = date;
							}
						}

						edit.text = text;
						account.edits.push(edit);
					}
					index++;
				}
		
				edit_history_parcels.push(account.apn);
				zone_edit_history_parcels.push(account);
		
				// Set in redis
				redis_client.set(SHERIFF_EDIT_HISTORY_PREFIX + account.apn, JSON.stringify(account));
			}, (fileName) => {

				// Set a cache object for all edit history by zone
				if (zone_edit_history_parcels.length <= 0) return;

				console.log("Creating zone object for zone: " + fileName.replace(".tsv", ""));

				redis_client.set(ZONE_EDIT_HISTORY_PREFIX + fileName.replace(".tsv", ""), JSON.stringify(zone_edit_history_parcels));
			})
		}
	});
}

exports.readRotationIntoMemory = (folder) => {
	if ( fs.existsSync(folder) == false ) return;
	
	fs.readdir(folder, (err, files) => {
		files.forEach(file => {
			var rotations = [];
			var input = fs.createReadStream(folder + "/" + file);
			readLines(input, file, (line) => {
				var fields = line.split('\t');
				var rotation = {}; // The rotation we're about to store the data in

				if ( fields[0] ) rotation.marker = fields[0]; else return;
				if ( fields[1] ) rotation.radians = parseFloat(fields[1]); else return;
				
				rotations.push(rotation);
			}, (fileName) => {

				// Set a cache object for all rotations by zone
				if (rotations.length <= 0) return;

				console.log("Loading rotations for zone: " + fileName.replace(".tsv", ""));
				console.log(rotations);

				redis_client.set(ZONE_ROTATION_PREFIX + fileName.replace(".tsv", ""), JSON.stringify(rotations));
			});
			
		});
	  })
}

function readLines(input, fileName, func, end) {
	var remaining = '';
  
	input.on('data', function(data) {
	  remaining += data;
	  var index = remaining.indexOf('\n');
	  while (index > -1) {
		var line = remaining.substring(0, index);
		remaining = remaining.substring(index + 1);
		func(line, fileName);
		index = remaining.indexOf('\n');
	  }
	});
  
	input.on('end', () => end(fileName));
  }

// Get the Edit History account object for a single parcel number (param apn)
exports.getEditHistory = (req, res, next) => {
	var apn = req.params.apn;
	var key = SHERIFF_EDIT_HISTORY_PREFIX + apn;

	redis_client.get(key,function (error, result) {
		if (error) {
			console.log(error);
			throw error;
		}

		if ( result == null ) 
		{
			var error = {};
			error.error_message = "Edit History for Parcel " + apn + " Not Found";
			return res.status(404).send(error);
		}

		var ret = JSON.parse(result);

		// Sort by date
		ret.edits.sort(function(a,b){
			return new Date(Date.parse(b.date)) - new Date(Date.parse(a.date));
		});

		res.send(ret);
	});
};

// Get a list of APNs that we have edit history data for
exports.getEditHistoryParcels = (req, res) => {
	res.send(edit_history_parcels);
}