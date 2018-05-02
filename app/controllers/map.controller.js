// Convert to a GeoJSON
var superagent_request = require("superagent");
var fs = require('fs');
var redis = require('redis');
var redis_client = redis.createClient();

const UPLOAD_PASSWORD = 'apache_county_eggdrop1315';

exports.convertBook = (req, res, next) => {	
	return convertToGeoJson(req, res, next, "books");
};

function convertToGeoJson(req, res, next, folder_name) {
	if (!req.files.file || !req.files.file.name) {
		res.status(400).json({error: true, msg: 'No file provided'})
		return;
	  }
	  
	  var data = req.files.file;
		var file_name = data.name.replace(".zip", ".json");
		var password = req.body.password;
		
		if ( password != UPLOAD_PASSWORD ) return res.json({"message": "Invalid Password"});

	  superagent_request
		  .post('http://ogre.adc4gis.com/convert')
		  .field('sourceSrs', '')
		  .field('targetSrs', '')
		  .attach('upload', data.path)
		  .end(function (er, res) {
			  if (er) return console.error(er)
			  
			  var sanitized = {};
			  sanitized.type = res.body.type;
			  sanitized.features = [];
  
			  // Go through each feature and verify that the polygon is properly closed (first coordinate is equal to the last one)
			  for ( var i = 0; i < res.body.features.length; i++ )
			  {
				  var feature = res.body.features[i];
	
					// Unclosed Polygons
				  {
						var first_lat_lon = feature.geometry.coordinates[0][0];
						var last_lat_lon = feature.geometry.coordinates[0][feature.geometry.coordinates[0].length - 1];

						if ( first_lat_lon[0] != last_lat_lon[0] && first_lat_lon[1] != last_lat_lon[1] )
						{
							console.log("Unclosed Polygon: " + feature.properties.PARCEL_NUM);
							feature.geometry.coordinates[0].push(feature.geometry.coordinates[0][0]);
						}
					}
					
					if ( feature.geometry.coordinates.length > 1 )
				  {
						feature.geometry.coordinates.splice(1);
					}
					
					if ( feature.geometry.type == 'MultiPolygon' )
					{
						// Convert a multipolygon into a polygon
						feature.geometry.type = 'Polygon';
						feature.geometry.coordinates[0] = feature.geometry.coordinates[0][0];
					}
  
				  if ( feature.properties.CON_NUMBER != null )
				  {
						// Con
				  }
				  else if ( feature.properties.DISTRICT != null ) 
				  {
						// Fire District
				  }
				  else
				  {
						// Normal Parcel

						if ( feature.properties.PARCEL_NUM == null ) continue; // Skip parcels that have no number
						if ( feature.properties.PARCEL_NUM.indexOf("INDEX") >= 0 ) continue; // Skip Indexes
				  }

				  sanitized.features.push(feature);

				  // Add to redis cache
				  if ( feature.properties.PARCEL_NUM != null )
				  {
					console.log("Writing " + feature.properties.PARCEL_NUM + " to Redis");
					redis_client.set(feature.properties.PARCEL_NUM, JSON.stringify(feature));
				  }
			  }
  
			  console.log("Finished parsing. Writing file");
			  fs.writeFile(__dirname + "/../../public/" + folder_name + "/" + file_name, JSON.stringify(sanitized), function(err) {
					if(err) {
						return console.log(err);
					}
				}); 
			});
			
			return res.json({"message": "The file was saved as " + file_name});
}

// Get all GeoJSONs
exports.listBook = (req, res, next) => {
	const folder = __dirname + "/../../public/books";

	fs.readdir(folder, (err, files) => {
		var map_files = [];

		for ( var i = 0; i < files.length; i++ )
		{
			// Skip the non JSONs
			if(files[i].indexOf('json') < 0 ) continue;

			map_files.push(files[i]);
		}
		res.json({"files": map_files});
	})
};
