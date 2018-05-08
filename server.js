// Import
var compression = require('compression');
var express = require('express');
var bodyParser = require('body-parser');
var multiparty = require('connect-multiparty');
var redis = require('redis');
var redis_client = redis.createClient();
var fs = require('fs');
var jsonfile = require('jsonfile');

const ZONE_BOOK_LIST_KEY_PREFIX = "ZONE_BOOK_LIST_"

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
require('./app/routes/zone.routes.js')(app);

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

  loadCacheZones();
  loadCacheParcels();

  function loadCacheZones()
  {
    loadZone(1, "Sanders", ["207", "209", "210"]);
    loadZone(2, "Sanders South", ["205", "206", "208", "211"]);
    loadZone(3, "St John's North", ["204"]);
    loadZone(4, "Concho", ["201", "212"]);
    loadZone(5, "St John's", ["108", "202", "203"]);
    loadZone(6, "Vernon", ["106", "107"]);
    loadZone(7, "Springerville/Eagar", ["101", "102", "103", "104", "105"]);

    function loadZone(num, name, books)
    {
      var zone = {};
      zone.num = num;
      zone.name = name;
      zone.books = books;

      var key = ZONE_BOOK_LIST_KEY_PREFIX + zone.num;
      redis_client.set(key, JSON.stringify(zone));
    }
  }

  function loadCacheParcels()
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
}
