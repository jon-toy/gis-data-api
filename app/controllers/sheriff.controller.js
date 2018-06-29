require('../../utils.js')();

var fs = require('fs');
var redis = require('redis');
var redis_client = redis.createClient();

const UPLOAD_PASSWORD = 'apache_county_eggdrop1315';

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

	// Save a copy
	fs.readFile(data.path, 'utf8', function(err, contents) {
    fs.writeFile(file_name, contents, function(err) {
			if(err) {
				return console.log(err);
			}
		}); 
	});

	// Load into memory
	exports.readEditHistoryIntoMemory(data.path);
	
	return res.json({"message": "The file was saved as " + file_name});
}

exports.readEditHistoryIntoMemory = (path) => {
	if ( fs.existsSync(path) == false ) return;
	
	var input = fs.createReadStream(path);
	readLines(input, (line) => {
		if ( line.indexOf('APN') >= 0 && line.indexOf('SITUS') && line.indexOf('ROAD') && line.indexOf('EDITS') ) return;
		var account = {}; // Account object to hold the data we're about to read in

		var fields = line.split('\t');
		if ( fields[0] ) account.apn = fields[0]; else return;
		if ( fields[1] ) account.situs = fields[1]; else return;
		if ( fields[2] ) account.road = fields[2]; else return;
		
		account.edits = [];
		var index = 3;
		while ( index < fields.length && fields[index] != null && fields[index].length > 0 )
		{
			if ( fields[index] != '\r' ) account.edits.push(fields[index]);
			index++;
		}

		// Set in redis
		redis_client.set(SHERIFF_EDIT_HISTORY_PREFIX + account.apn, JSON.stringify(account));
	});
}

function readLines(input, func) {
	var remaining = '';
  
	input.on('data', function(data) {
	  remaining += data;
	  var index = remaining.indexOf('\n');
	  while (index > -1) {
		var line = remaining.substring(0, index);
		remaining = remaining.substring(index + 1);
		func(line);
		index = remaining.indexOf('\n');
	  }
	});
  
	input.on('end', function() {
	  if (remaining.length > 0) {
		func(remaining);
	  }
	});
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

		res.send(JSON.parse(result));
	});
};
