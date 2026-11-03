require("../../utils.js")();
var csv_parser = require("csv-parse/sync");
var fs = require("fs");
var { IncomingForm } = require("formidable");
const { client: redis_client } = require("../../redis-client");

var edit_history_parcels = [];

const UPLOAD_PASSWORD = "apache_county_eggdrop1315";
const s3 = require("../../aws-s3-client");

exports.postTylerData = (req, res, next) => {
  return parseTylerDataCsvFile(req, res, next, "tyler");
};

function parseTylerDataCsvFile(req, res, next, folder_name) {
  const form = new IncomingForm({
    keepExtensions: true,
    allowEmptyFiles: true,
    minFileSize: 0,
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      res.writeHead(err.httpCode || 400, { "Content-Type": "text/plain" });
      res.end(String(err));
      return;
    }

    const uploadedFile = files.file || files.upload || Object.values(files)[0];
    if (!uploadedFile || !uploadedFile.name) {
      res.status(400).json({ error: true, msg: "No CSV File provided" });
      return;
    }

    var data = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;
    if (Number(data.size || 0) <= 0) {
      res.status(400).json({ error: true, msg: "File is empty" });
      return;
    }

    var file_name =
      __dirname + "/../../public/" + folder_name + "/" + TYLER_DATA_FILENAME;
    console.log(
      "Uploaded Tyler data. Saving as " + folder_name + "/" + data.name,
    );

    fs.readFile(data.path, "utf8", function (err, contents) {
      // Save a copy to S3
      uploadJSONToS3(
        "tyler/" + TYLER_DATA_FILENAME,
        contents,
        function (err, data) {
          if (!err) exports.readTylerDataIntoMemory(data);
          else console.error(err);
        },
      );

      // Load into memory
      exports.readTylerDataIntoMemory(data.path);
    });

    return res.json({ message: "The file was saved as " + file_name });
  });
}

exports.readTylerDataIntoMemory = () => {
  console.log("Reading Tyler Data into Memory");
  return new Promise((resolve) => {
    var params = {
      Bucket: S3_BUCKET_NAME,
      Delimiter: "/",
      Prefix: "gis-data-api/tyler/",
    };

    s3.listObjectsV2(params, async (err, data) => {
      if (err) {
        console.error("Unable to list Tyler S3 objects:", err);
        resolve();
        return;
      }

      if (!data || !Array.isArray(data.Contents)) {
        console.warn("No Tyler data found in S3:", data);
        resolve();
        return;
      }

      const files = [];
      for (var i = 0; i < data.Contents.length; i++) {
        var file = data.Contents[i].Key.replace("gis-data-api/tyler/", "");
        if (file.indexOf("tyler.csv") < 0) continue;
        files.push(data.Contents[i]);
      }

      try {
        for (const item of files) {
          await new Promise((innerResolve) => {
            s3.getObject(
              { Bucket: S3_BUCKET_NAME, Key: item.Key },
              async function (err, s3Data) {
                try {
                  if (err) {
                    console.log(err);
                    innerResolve();
                    return;
                  }

                  if (!s3Data || s3Data.Body == null) {
                    console.warn(
                      "Skipping Tyler payload with empty S3 body:",
                      s3Data,
                    );
                    innerResolve();
                    return;
                  }

                  const csvText = s3Data.Body.toString();
                  if (!csvText || !csvText.trim()) {
                    console.warn(
                      "Skipping Tyler payload with empty CSV content:",
                      s3Data && s3Data.Key,
                    );
                    innerResolve();
                    return;
                  }

                  const records = csv_parser.parse(csvText, {
                    columns: true,
                    skip_empty_lines: true,
                    raw: true,
                    bom: true,
                  });

                  const writes = [];
                  for (var i = 0; i < records.length; i++) {
                    var record = records[i];
                    var json = record.record;
                    json.raw = record.raw;

                    let dateArray =
                      s3Data.LastModified.toLocaleDateString().split("/");
                    if (dateArray.length === 3) {
                      if (dateArray[0].length < 2)
                        dateArray[0] = "0" + dateArray[0];
                      if (dateArray[1].length < 2)
                        dateArray[0] = "0" + dateArray[0];
                      if (dateArray[2].length === 4)
                        dateArray[2] = dateArray[2].substring(2, 4);
                      json.lastUploaded = dateArray.join("/");
                    }

                    writes.push([
                      TYLER_DATA_PREFIX + json["Parcel Number"],
                      JSON.stringify(json),
                    ]);
                  }

                  console.log(
                    `Tyler warmup writing ${writes.length} keys from ${item.Key}`,
                  );

                  for (let index = 0; index < writes.length; index += 25) {
                    const chunk = writes.slice(index, index + 25);
                    for (const [redisKey, value] of chunk) {
                      await redis_client.set(redisKey, value);
                    }
                  }

                  console.log(`Loaded Tyler.csv data from ${item.Key}`);
                  innerResolve();
                } catch (error) {
                  console.error(
                    "Failed to warm Tyler data for key:",
                    item.Key,
                    error,
                  );
                  innerResolve();
                }
              },
            );
          });
        }
        resolve();
      } catch (error) {
        console.error("Tyler data warmup failed:", error);
        resolve();
      }
    });
  });
};

// Get the Tyler data for a single parcel number (param apn)
exports.getTylerData = async (req, res, next) => {
  var apn = req.query.apn;
  var key = TYLER_DATA_PREFIX + apn;

  try {
    const result = await redis_client.get(key);

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

    return res.send(ret);
  } catch (error) {
    console.error("Unable to load Tyler data for apn:", apn, error);
    return res.status(500).json({ error: true, msg: "Unable to load Tyler data" });
  }
};
