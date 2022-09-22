require("../../utils.js")();
var csv_parser = require("csv-parse/sync");
var fs = require("fs");
var redis = require("redis");
var redis_client = redis.createClient();
var formidable = require("formidable");

var edit_history_parcels = [];

const UPLOAD_PASSWORD = "apache_county_eggdrop1315";
const AWS = require("aws-sdk");
const s3 = new AWS.S3();

exports.postTylerData = (req, res, next) => {
  return parseTylerDataCsvFile(req, res, next, "tyler");
};

function parseTylerDataCsvFile(req, res, next, folder_name) {
  const form = formidable({ keepExtensions: true });

  form.parse(req, (err, fields, files) => {
    if (err) {
      res.writeHead(err.httpCode || 400, { "Content-Type": "text/plain" });
      res.end(String(err));
      return;
    }

    if (!files.file) {
      res.status(400).json({ error: true, msg: "No CSV File provided" });
      return;
    }

    var data = files.file;

    var file_name =
      __dirname + "/../../public/" + folder_name + "/" + TYLER_DATA_FILENAME;
    console.log(
      "Uploaded Tyler data. Saving as " + folder_name + "/" + data.name
    );

    fs.readFile(data.path, "utf8", function (err, contents) {
      // TODO: Re-enable this for prod
      //Save a copy to S3
      //     uploadJSONToS3(
      //     "tyler/" + TYLER_DATA_FILENAME,
      //     contents,
      //     function (err, data) {
      //       if (!err) exports.readTylerDataIntoMemory(data);
      //       else console.error(err);
      //     }
      //   );

      // Load into memory
      exports.readTylerDataIntoMemory(data.path);
    });

    return res.json({ message: "The file was saved as " + file_name });
  });
}

exports.readTylerDataIntoMemory = () => {
  var params = {
    Bucket: S3_BUCKET_NAME,
    Delimiter: "/",
    Prefix: "gis-data-api/tyler/",
  };

  s3.listObjectsV2(params, (err, data) => {
    for (var i = 0; i < data.Contents.length; i++) {
      // Skip any file not called tyler.csv
      var file = data.Contents[i].Key.replace("gis-data-api/tyler/", "");
      if (file.indexOf("tyler.csv") < 0) continue;

      var s3Stream = s3.getObject(
        { Bucket: S3_BUCKET_NAME, Key: data.Contents[i].Key },
        function (err, data) {
          if (err) {
            console.log(err);
            return;
          }

          // Read the CSV file
          // Initialize the parser
          const records = csv_parser.parse(data.Body.toString(), {
            columns: true,
            skip_empty_lines: true,
            raw: true,
            bom: true,
          });
          for (var i = 0; i < records.length; i++) {
            var record = records[i];

            // Structure the JSON obj so it has the raw string on it
            var json = record.record;
            json.raw = record.raw;

            // Include the upload date
            json.lastUploaded = data.LastModified.toDateString();

            redis_client.set(
              TYLER_DATA_PREFIX + json["Parcel Number"],
              JSON.stringify(json)
            );
          }

          console.log("Loaded Tyler.csv data");
        }
      );
    }
  });
};

// Get the Tyler data for a single parcel number (param apn)
exports.getTylerData = (req, res, next) => {
  var apn = req.query.apn;
  var key = TYLER_DATA_PREFIX + apn;

  redis_client.get(key, function (error, result) {
    if (error) {
      console.log(error);
      throw error;
    }

    if (result == null) {
      var error = {};
      error.error_message =
        "Tyler Data for Parcel " +
        apn +
        " Not Found. Be sure to include ?apn=<apn number> on your request.";
      return res.status(404).send(error);
    }

    var ret = JSON.parse(result);

    if (req.query.raw) {
      return res.send(ret.raw);
    }

    res.send(ret);
  });
};
