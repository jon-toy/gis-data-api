require('../../utils.js')();

var redis = require('redis');
var redis_client = redis.createClient();

// Find a single parcel with a parcelNum
exports.findOneParcel = (req, res) => {
	var parcel_num = req.params.parcelNum;
	parcel_num = normalizeParcelNumber(parcel_num);
	redis_client.get(parcel_num,function (error, result) {
		if (error) {
			console.log(error);
			throw error;
		}

		if ( result == null ) 
		{	
			var error = {};
			error.error_message = "Parcel " + parcel_num + " not found.";
			return res.status(404).send(error);
		}

		res.send(JSON.parse(result));
	});
};
