// Import
var compression = require('compression');
var express = require('express');
var bodyParser = require('body-parser');
var multiparty = require('connect-multiparty');
var redis = require('redis');
var redis_client = redis.createClient();
var fs = require('fs');
var jsonfile = require('jsonfile');

// Instantiate
const app = express();

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// Multipart post data parser
app.use(multiparty());

// GZIP Compression
app.use(compression());

// Allow CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Routes for maps
require('./app/routes/map.routes.js')(app);
require('./app/routes/parcel.routes.js')(app);

// Static files
app.use(express.static(__dirname + '/public'));

// Load GeoJSON cache on startup
loadCacheOnStartup();

// listen for requests
app.listen(3001, () => {
    console.log("Server is listening on port 3001");
});

function loadCacheOnStartup()
{
  const folder = __dirname + "/public/books";

	fs.readdir(folder, (err, files) => {

		for ( var i = 0; i < files.length; i++ )
		{
      if(files[i].indexOf('json') < 0 ) continue; // Skip non-JSONs

      var file_name = files[i];
      
      jsonfile.readFile(folder + "/" + file_name, function(err, obj) {
        if ( err != null )
        {
          console.log(err);

        }
        // Load the JSON into Redis
        for ( var j = 0; j < obj.features.length; j++ ) 
        {
          var feature = obj.features[j];

          if ( feature.properties.PARCEL_NUM == null ) continue; // Skip parcels that have no number

          console.log("Writing " + feature.properties.PARCEL_NUM + " to Redis");
          redis_client.set(feature.properties.PARCEL_NUM, JSON.stringify(feature));
        }
      });
		}
	});
}