require('../../utils.js')();

var fs = require('fs');
var redis = require('redis');
var redis_client = redis.createClient();

var edit_history_parcels = [];

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

exports.readEditHistoryIntoMemory = (folder) => {
	if ( fs.existsSync(folder) == false ) return;
	
	fs.readdir(folder, (err, files) => {
		files.forEach(file => {
			var zone_edit_history_parcels = [];
			var input = fs.createReadStream(folder + "/" + file);
			readLines(input, (line) => {
				if ( line.indexOf('APN') >= 0 && line.indexOf('SITUS') && line.indexOf('ROAD') && line.indexOf('EDITS') ) return;
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
					if ( fields[index] != '\r' ) account.edits.push(fields[index]);
					index++;
				}
		
				edit_history_parcels.push(account.apn);
				zone_edit_history_parcels.push(account);
		
				// Set in redis
				redis_client.set(SHERIFF_EDIT_HISTORY_PREFIX + account.apn, JSON.stringify(account));
			}, () => {

				// Set a cache object for all edit history by zone
				if (zone_edit_history_parcels.length <= 0) return;

				console.log("Creating zone object for zone: " + file.replace(".tsv", ""));
				console.log(zone_edit_history_parcels);

				redis_client.set(ZONE_EDIT_HISTORY_PREFIX + file.replace(".tsv", ""), JSON.stringify(zone_edit_history_parcels));
			});
			
		});
	  })
}

function readLines(input, func, end) {
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
  
	input.on('end', end);
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

// Get a list of APNs that we have edit history data for
exports.getEditHistoryParcels = (req, res) => {
	res.send(edit_history_parcels);
}