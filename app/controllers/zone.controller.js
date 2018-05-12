var redis = require('redis');
var redis_client = redis.createClient();

const ZONE_BOOK_LIST_KEY_PREFIX = "ZONE_BOOK_LIST_"

// Find a list of books for a given zone
exports.findBooksForZone = (req, res) => {
	var zone_num = req.params.zoneNum;
	var key = ZONE_BOOK_LIST_KEY_PREFIX + zone_num;

	redis_client.get(key,function (error, result) {
		if (error) {
			console.log(error);
			throw error;
		}

		if ( result == null ) return res.status(404).send("Zone " + zone_num + " Not Found");

		res.send(JSON.parse(result));
	});
};

// Find a zone for a given book 
exports.findZoneForBook = (req, res) => {
	var book_num = req.params.bookNum;
	var key = BOOK_ZONE_KEY_PREFIX + book_num;

	redis_client.get(key,function (error, result) {
		if (error) {
			console.log(error);
			throw error;
		}

		if ( result == null ) 
		{
			var error = {};
			error.error_message = "Zone for Book " + book_num + " Not Found";
			return res.status(404).send(error);
		}

		var response = {};
		response.zone = result;
		res.send(response);
	});
};
