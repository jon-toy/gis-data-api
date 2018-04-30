var redis = require('redis');
var redis_client = redis.createClient();

// Find a single parcel with a parcelNum
exports.findOneParcel = (req, res) => {
	var parcel_num = req.params.parcelNum;
	redis_client.get(parcel_num,function (error, result) {
		if (error) {
			console.log(error);
			throw error;
		}

		if ( result == null ) return res.status(404).send("Parcel " + parcel_num + " Not Found");

		res.send(JSON.parse(result));
	});
};
