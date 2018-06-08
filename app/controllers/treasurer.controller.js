require('../../utils.js')();

// Convert to a GeoJSON
var superagent_request = require("superagent");
var fs = require('fs');
var redis = require('redis');
var redis_client = redis.createClient();

const UPLOAD_PASSWORD = 'apache_county_eggdrop1315';

exports.convertAccountBalance = (req, res, next) => {	
	return parseTextFile(req, res, next, "treasurer");
};

function parseTextFile(req, res, next, folder_name) 
{
	if (!req.files.file || !req.files.file.name) {
		res.status(400).json({error: true, msg: 'No file provided'})
		return;
	  }
	  
	var data = req.files.file;
	var password = req.body.password;
	
	if ( password != UPLOAD_PASSWORD ) return res.json({"message": "Invalid Password"});

	var file_name = __dirname + "/../../public/" + folder_name + "/" + BALANCE_DUE_FILENAME;
	console.log("Uploaded treasurer export. Saving as " + folder_name + "/" + data.name);

	// Save a copy
	fs.readFile(data.path, 'utf8', function(err, contents) {
    fs.writeFile(file_name, contents, function(err) {
			if(err) {
				return console.log(err);
			}
		}); 
	});

	// Load into memory
	readBalanceDueIntoMemory(data.path);
	
	return res.json({"message": "The file was saved as " + file_name});
}

function readBalanceDueIntoMemory(path)
{
	var input = fs.createReadStream(path);
	var lines = readLines(input, (line) => {
		var account = {}; // Account object to hold the data we're about to read in

		account.account_number = line.substring(0, 14).trim();
		account.balance_due = line.substring(312, 321).trim();

		// Set in redis
		redis_client.set(TREASURER_BALANCE_DUE_PREFIX + account.account_number, JSON.stringify(account));
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

// Get the account balance for a single account number (param accountNum)
exports.getAccountBalance = (req, res, next) => {
	var account_num = req.params.accountNum;
	var key = TREASURER_BALANCE_DUE_PREFIX + account_num;

	redis_client.get(key,function (error, result) {
		if (error) {
			console.log(error);
			throw error;
		}

		if ( result == null ) 
		{
			var error = {};
			error.error_message = "Balance Due for Account " + account_num + " Not Found";
			return res.status(404).send(error);
		}

		var response = {};
		response.zone = result;
		res.send(response);
	});
};
