require("../../utils.js")();

var fs = require("fs");
var { IncomingForm } = require("formidable");
const { client: redis_client } = require("../../redis-client");

var edit_history_parcels = [];

const UPLOAD_PASSWORD = "apache_county_eggdrop1315";
const s3 = require("../../aws-s3-client");

exports.convertEditReport = (req, res, next) => {
  return parseEditReportCsvFile(req, res, next, "sheriff");
};

function unwrapUploadedFile(value) {
  if (!value) return null;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const unwrapped = unwrapUploadedFile(entry);
      if (unwrapped) return unwrapped;
    }
    return null;
  }

  if (
    typeof value === "object" &&
    (value.filepath ||
      value.path ||
      value.originalFilename ||
      value.newFilename ||
      value.name ||
      value.size !== undefined)
  ) {
    return value;
  }

  return null;
}

function getUploadedFile(files) {
  if (!files) return null;

  for (const key of ["file", "upload"]) {
    const file = unwrapUploadedFile(files[key]);
    if (file) return file;
  }

  for (const value of Object.values(files)) {
    const file = unwrapUploadedFile(value);
    if (file) return file;
  }

  return null;
}

function parseEditReportCsvFile(req, res, next, folder_name) {
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

    const data = getUploadedFile(files);
    if (!data) {
      res.status(400).json({ error: true, msg: "No file provided" });
      return;
    }

    if (Number(data.size || 0) <= 0) {
      res.status(400).json({ error: true, msg: "File is empty" });
      return;
    }

    const password = fields.password;
    if (password != UPLOAD_PASSWORD) {
      return res.json({ message: "Invalid Password" });
    }

    const filePath = data.filepath || data.path;
    const originalFilename =
      data.originalFilename || data.name || data.newFilename;
    const file_name =
      __dirname + "/../../public/" + folder_name + "/" + EDIT_HISTORY_FILENAME;
    console.log(
      "Uploaded sheriff edit history export. Saving as " +
        folder_name +
        "/" +
        originalFilename,
    );

    // Save a copy to S3
    fs.readFile(filePath, "utf8", function (err, contents) {
      if (err) {
        console.error("Sheriff file read failed:", err);
        res
          .status(500)
          .json({ error: true, msg: "Failed to read uploaded file" });
        return;
      }

      uploadFileToS3(
        "ruraladdress/" + EDIT_HISTORY_FILENAME,
        { path: filePath },
        function (err, data) {
          if (!err) exports.readEditHistoryIntoMemory(filePath);
          else console.error(err);
        },
      );
    });

    // Load into memory
    exports.readEditHistoryIntoMemory(filePath);

    return res.json({ message: "The file was saved as " + file_name });
  });
}

exports.readEditHistoryIntoMemory = (folder) => {
  return new Promise((resolve) => {
    var params = {
      Bucket: S3_BUCKET_NAME,
      Delimiter: "/",
      Prefix: "gis-data-api/ruraladdress/",
    };

    s3.listObjectsV2(params, async (err, data) => {
      if (err) {
        console.error(
          "S3 listObjectsV2 failed in sheriff readEditHistoryIntoMemory:",
          err,
        );
        resolve();
        return;
      }

      if (!data || !Array.isArray(data.Contents)) {
        console.error(
          "Unexpected S3 response in sheriff readEditHistoryIntoMemory:",
          data,
        );
        resolve();
        return;
      }

      const filesToProcess = [];
      for (var i = 0; i < data.Contents.length; i++) {
        const file = data.Contents[i].Key.replace(
          "gis-data-api/ruraladdress/",
          "",
        );
        if (file.indexOf("rotation") >= 0) continue;
        filesToProcess.push({ file, key: data.Contents[i].Key });
      }

      try {
        for (const item of filesToProcess) {
          const s3Stream = s3
            .getObject({ Bucket: S3_BUCKET_NAME, Key: item.key })
            .createReadStream();

          await readLines(
            s3Stream,
            item.file,
            (line, fileName, zone_edit_history_parcels) => {
              if (
                line.indexOf("APN") >= 0 &&
                line.indexOf("SITUS") >= 0 &&
                line.indexOf("ROAD") >= 0 &&
                line.indexOf("EDITS") >= 0
              )
                return;

              var account = {};
              var fields = line.split("\t");
              if (fields[0]) account.apn = fields[0];
              else return;
              if (fields[1]) account.situs = fields[1];
              else return;
              if (fields[2]) account.road = fields[2];
              else return;
              if (fields[3]) account.owner = fields[3];
              else return;
              if (fields[4]) {
                if (fields[4] != "NULL") account.remarks = fields[4];
                else account.remarks = "";
              } else return;

              account.edits = [];
              var index = 5;
              while (
                index < fields.length &&
                fields[index] != null &&
                fields[index].length > 0
              ) {
                if (fields[index] != "\r") {
                  var edit = {};
                  var text = fields[index];

                  if (text.length > 10) {
                    var dateStringRaw = fields[index].substring(
                      text.length - 10,
                      text.length,
                    );

                    var date = dateStringRaw.replace("(", "").replace(")", "");
                    var dateRegex = `[0-9][0-9]\/[0-9][0-9]\/[0-9][0-9]`;
                    var result = date.match(dateRegex);
                    if (result == null) {
                      // invalid date, ignore
                    } else {
                      text = text.replace(dateStringRaw, "");
                      edit.date = date;
                    }
                  }

                  edit.text = text;
                  account.edits.push(edit);
                }
                index++;
              }

              edit_history_parcels.push(account.apn);
              zone_edit_history_parcels.push(account);
            },
            async (fileName, zone_edit_history_parcels) => {
              if (zone_edit_history_parcels.length <= 0) return;

              const zoneName = fileName.replace(".tsv", "");

              console.log(
                "Creating zone object for zone: " + zoneName,
              );
              console.log(
                "Number of parcels: " + zone_edit_history_parcels.length,
              );

              const zoneKey = ZONE_EDIT_HISTORY_PREFIX + zoneName;
              const zonePayload = JSON.stringify(zone_edit_history_parcels);

              for (let index = 0; index < zone_edit_history_parcels.length; index += 25) {
                const chunk = zone_edit_history_parcels.slice(index, index + 25);
                for (const account of chunk) {
                  await redis_client.set(
                    SHERIFF_EDIT_HISTORY_PREFIX + account.apn,
                    JSON.stringify(account),
                  );
                }
              }

              await redis_client.set(zoneKey, zonePayload);
            },
          );
        }
        resolve();
      } catch (err) {
        console.error("Sheriff edit history warmup failed:", err);
        resolve();
      }
    });
  });
};

exports.readRotationIntoMemory = (folder) => {
  if (!folder || typeof folder !== "string") return Promise.resolve();
  if (fs.existsSync(folder) == false) return Promise.resolve();

  try {
    const stats = fs.statSync(folder);
    if (!stats.isDirectory()) return Promise.resolve();
  } catch (err) {
    console.warn("Rotation directory unavailable:", err.message);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    fs.readdir(folder, async (err, files) => {
      if (err) {
        console.warn("Could not read rotation directory:", err.message);
        resolve();
        return;
      }

      if (!Array.isArray(files)) {
        resolve();
        return;
      }

      try {
        for (const file of files) {
          var rotations = [];
          var input = fs.createReadStream(folder + "/" + file);
          await readLines(
            input,
            file,
            (line) => {
              var fields = line.split("\t");
              var rotation = {};

              if (fields[0]) rotation.marker = fields[0];
              else return;
              if (fields[1]) rotation.radians = parseFloat(fields[1]);
              else return;

              rotations.push(rotation);
            },
            async (fileName) => {
              if (rotations.length <= 0) return;

              console.log(
                "Loading rotations for zone: " + fileName.replace(".tsv", ""),
              );
              console.log(rotations);

              await redis_client.set(
                ZONE_ROTATION_PREFIX + fileName.replace(".tsv", ""),
                JSON.stringify(rotations),
              );
            },
          );
        }
        resolve();
      } catch (error) {
        console.error("Rotation warmup failed:", error);
        resolve();
      }
    });
  });
};

function readLines(input, fileName, func, end) {
  return new Promise((resolve, reject) => {
    var remaining = "";
    let zone_edit_history_parcels = [];

    input.on("data", function (data) {
      remaining += data;
      var index = remaining.indexOf("\n");
      while (index > -1) {
        var line = remaining.substring(0, index);
        remaining = remaining.substring(index + 1);
        func(line, fileName, zone_edit_history_parcels);
        index = remaining.indexOf("\n");
      }
    });

    input.on("end", async () => {
      try {
        if (end) {
          await end(fileName, zone_edit_history_parcels);
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    input.on("error", (err) => reject(err));
  });
}

// Get the Edit History account object for a single parcel number (param apn)
exports.getEditHistory = async (req, res, next) => {
  var apn = req.params.apn;
  var key = SHERIFF_EDIT_HISTORY_PREFIX + apn;

  try {
    const result = await redis_client.get(key);

    if (result == null) {
      var error = {};
      error.error_message = "Edit History for Parcel " + apn + " Not Found";
      return res.status(404).send(error);
    }

    var ret = JSON.parse(result);

    // Sort by date
    ret.edits.sort(function (a, b) {
      return new Date(Date.parse(b.date)) - new Date(Date.parse(a.date));
    });

    return res.send(ret);
  } catch (error) {
    console.error("Unable to load sheriff edit history for apn:", apn, error);
    return res.status(500).json({ error: true, msg: "Unable to load edit history" });
  }
};

// Get a list of APNs that we have edit history data for
exports.getEditHistoryParcels = (req, res) => {
  res.send(edit_history_parcels);
};
