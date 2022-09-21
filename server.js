// Import
const compression = require("compression");
const express = require("express");
const bodyParser = require("body-parser");
const multiparty = require("connect-multiparty");
const redis = require("redis");
const redis_client = redis.createClient();
const sheriff = require("./app/controllers/sheriff.controller.js");
const tyler = require("./app/controllers/tyler.controller.js");
const AWS = require("aws-sdk");
const s3 = new AWS.S3();

// Instantiate
const app = express();

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// Multipart post data parser
//app.use(multiparty());

// GZIP Compression
app.use(compression());

// Allow CORS
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Routes for maps
require("./app/routes/map.routes.js")(app);
require("./app/routes/parcel.routes.js")(app);
require("./app/routes/zone.routes.js")(app);
require("./app/routes/treasurer.routes.js")(app);
require("./app/routes/sheriff.routes.js")(app);
require("./app/routes/ruraladdress.routes.js")(app);
require("./app/routes/tools.routes.js")(app);
require("./app/routes/transportation.routes.js")(app);
require("./app/routes/firecontacts.routes.js")(app);
require("./app/routes/books.routes.js")(app);
require("./app/routes/system.routes.js")(app);
require("./app/routes/tyler.routes.js")(app);

// Static files
app.use(express.static(__dirname + "/public"));

// Utils
require("./utils.js")(app);

// Load GeoJSON cache on startup
loadCacheOnStartup();

// listen for requests
app.listen(3001, () => {
  console.log("Server is listening on port 3001");
});

function loadCacheOnStartup() {
  loadCacheZones();
  loadCacheParcels();
  loadCacheSheriffEditHistory();
  loadCacheSheriffRotation();
  loadCacheTylerData();

  function loadCacheZones() {
    loadZone(
      1,
      "Sanders",
      ["207.json", "209.json", "210.json"],
      35.1518,
      -109.5042,
      13
    );
    loadZone(
      2,
      "Sanders South",
      ["205.json", "206.json", "208.json", "211.json"],
      34.951286499999995,
      -109.44762600000001,
      13
    );
    loadZone(3, "St John's North", ["204.json"], 34.7501, -109.1778, 13);
    loadZone(
      4,
      "Concho",
      ["201.json", "212.json"],
      34.5180075,
      -109.69512700000001,
      13
    );
    loadZone(
      5,
      "St John's",
      ["108.json", "202.json", "203.json"],
      34.384599,
      -109.29469749999998,
      13
    );
    loadZone(
      6,
      "Vernon",
      ["106.json", "107.json"],
      34.2367455,
      -109.68258000000003,
      13
    );
    loadZone(
      7,
      "Springerville/Eagar",
      ["101.json", "102.json", "103.json", "104.json", "105.json"],
      34.1096,
      -109.2906,
      13
    );

    function loadZone(
      num,
      name,
      books,
      starting_lat,
      starting_lon,
      starting_zoom
    ) {
      var zone = {};
      zone.num = num;
      zone.name = name;
      zone.books = books;
      zone.starting_lat = starting_lat;
      zone.starting_lon = starting_lon;
      zone.starting_zoom = starting_zoom;

      var key = ZONE_BOOK_LIST_KEY_PREFIX + zone.num;
      redis_client.set(key, JSON.stringify(zone));

      // Load book to zone keys
      for (var i = 0; i < books.length; i++) {
        var book_name = books[i].replace(".json", "");
        var book_key = BOOK_ZONE_KEY_PREFIX + book_name;
        redis_client.set(book_key, num);
      }
    }
  }

  function loadCacheParcels() {
    var params = {
      Bucket: S3_BUCKET_NAME,
      Delimiter: "/",
      Prefix: "gis-data-api/books/",
    };

    s3.listObjectsV2(params, (err, data) => {
      for (var i = 0; i < data.Contents.length; i++) {
        // Skip non JSONs
        if (data.Contents[i].Key.indexOf("json") < 0) continue;

        s3.getObject(
          { Bucket: S3_BUCKET_NAME, Key: data.Contents[i].Key },
          function (err, data) {
            if (err != null) {
              console.log(err);
            }

            const obj = JSON.parse(data.Body.toString());

            // Load the JSON into Redis
            for (var j = 0; j < obj.features.length; j++) {
              var feature = obj.features[j];

              if (feature.properties.PARCEL_NUM == null) continue; // Skip parcels that have no number

              var key = normalizeParcelNumber(feature.properties.PARCEL_NUM);

              var stringified = JSON.stringify(feature);
              redis_client.set(key, stringified); // By Parcel Number

              if (feature.properties.NUMBER != null) {
                redis_client.set(
                  normalizeAccountNumber(feature.properties.NUMBER),
                  stringified
                ); // By Account Number
              }
            }
          }
        );
      }
    });
  }

  function loadCacheSheriffEditHistory() {
    sheriff.readEditHistoryIntoMemory(__dirname + "/public/ruraladdress");
  }

  function loadCacheSheriffRotation() {
    sheriff.readRotationIntoMemory(__dirname + "/public/ruraladdress/rotation");
  }

  function loadCacheTylerData() {
    tyler.readTylerDataIntoMemory();
  }
}
