require("../../utils.js")();

// Convert to a GeoJSON
var superagent_request = require("superagent");
var { IncomingForm } = require("formidable");
var fs = require("fs");
var redis = require("redis");
var redis_client = redis.createClient({ legacyMode: true });
redis_client.connect().catch((err) => {
  console.error("Map Redis connect failed:", err);
});

const UPLOAD_PASSWORD = "apache_county_eggdrop1315";
const s3 = require("../../aws-s3-client");

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
    const file = files[key];
    const unwrapped = unwrapUploadedFile(file);
    if (unwrapped) return unwrapped;
  }

  for (const value of Object.values(files)) {
    const unwrapped = unwrapUploadedFile(value);
    if (unwrapped) return unwrapped;
  }

  return null;
}

exports.convertBook = (req, res, next) => {
  // parse a file upload
  const form = new IncomingForm({
    keepExtensions: true,
    allowEmptyFiles: true,
    minFileSize: 0,
  });

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error("Formidable upload parse error:", err);
      res.writeHead(err.httpCode || 400, { "Content-Type": "text/plain" });
      res.end(String(err));
      return;
    }

    const uploadedFile = getUploadedFile(files);
    const passwordValue = Array.isArray(fields.password)
      ? fields.password[0]
      : fields.password;
    console.log(
      "uploaded file keys:",
      files ? Object.keys(files) : [],
      "fields:",
      Object.keys(fields || {}),
    );
    if (
      !uploadedFile ||
      !(
        uploadedFile.originalFilename ||
        uploadedFile.name ||
        uploadedFile.newFilename
      )
    ) {
      console.error("Upload rejected: no valid file in multipart payload", {
        files,
        fields,
      });
      res.status(400).json({ error: true, msg: "No file provided" });
      return;
    }

    if (Number(uploadedFile.size || 0) <= 0) {
      console.error("Upload rejected: empty file payload", {
        size: uploadedFile.size,
        fields,
      });
      res.status(400).json({ error: true, msg: "File is empty" });
      return;
    }

    return convertToGeoJson(
      req,
      res,
      next,
      "books",
      uploadedFile,
      passwordValue,
    );
  });
};

function sanitizeFeature(feature) {
  var ret = {};
  ret.feature = null;
  ret.unclosed = [];
  // Unclosed Polygons
  {
    var first_lat_lon = feature.geometry.coordinates[0][0];
    var last_lat_lon =
      feature.geometry.coordinates[0][
        feature.geometry.coordinates[0].length - 1
      ];

    if (
      first_lat_lon[0] != last_lat_lon[0] &&
      first_lat_lon[1] != last_lat_lon[1]
    ) {
      console.log("Unclosed Polygon: " + feature.properties.PARCEL_NUM);
      ret.unclosed.push(feature.properties.PARCEL_NUM);
      feature.geometry.coordinates[0].push(feature.geometry.coordinates[0][0]);
    }
  }

  if (feature.geometry.coordinates.length > 1) {
    feature.geometry.coordinates.splice(1);
  }

  if (feature.geometry.type == "MultiPolygon") {
    // Convert a multipolygon into a polygon
    feature.geometry.type = "Polygon";
    feature.geometry.coordinates[0] = feature.geometry.coordinates[0][0];
    console.log("MultiPolygon: " + feature.properties.PARCEL_NUM);
  }

  if (feature.properties.CON_NUMBER != null) {
    // Con
  } else if (feature.properties.DISTRICT != null) {
    // Fire District
  } else if (feature.properties.ZONE != null) {
    // Zone
  } else {
    // Normal Parcel

    if (feature.properties.PARCEL_NUM == null) return null; // Skip parcels that have no number
    if (feature.properties.PARCEL_NUM.indexOf("INDEX") >= 0) return null; // Skip Indexes
  }

  ret.feature = reduceDecimal(feature);

  return ret;
}

function reduceDecimal(feature) {
  for (var i = 0; i < feature.geometry.coordinates[0].length; i++) {
    var lat_lon = feature.geometry.coordinates[0][i];
    var reduced = [];
    if (lat_lon[0] == null || lat_lon[1] == null) continue;

    reduced.push(Math.round(lat_lon[0] * 1e6) / 1e6);
    reduced.push(Math.round(lat_lon[1] * 1e6) / 1e6);
    feature.geometry.coordinates[0][i] = reduced;
  }

  return feature;
}

function convertToGeoJson(req, res, next, folder_name, file, password) {
  console.log(req);
  if (!file) {
    res.status(400).json({ error: true, msg: "No file provided" });
    return;
  }

  var data = file;
  console.log(file);
  const originalName =
    data.originalFilename || data.name || data.newFilename || "upload.zip";
  const filePath = data.filepath || data.path || "";
  var file_name = originalName.replace(".zip", ".json");

  if (password != UPLOAD_PASSWORD)
    return res.json({ message: "Invalid Password" });

  if (!filePath) {
    return res
      .status(400)
      .json({ error: true, msg: "Uploaded file path missing" });
  }

  superagent_request
    .post("http://ogre.adc4gis.com/convert")
    .field("sourceSrs", "")
    .field("targetSrs", "")
    .attach("upload", filePath, originalName)
    .end((er, s_res) => {
      if (er) return console.error(er);

      var sanitized = {};
      sanitized.type = s_res.body.type;
      sanitized.features = [];

      var unclosed = [];

      // Go through each feature and verify that the polygon is properly closed (first coordinate is equal to the last one)
      for (var i = 0; i < s_res.body.features.length; i++) {
        var result = sanitizeFeature(s_res.body.features[i]);
        var feature = result.feature;

        if (feature == null) continue;

        for (var j = 0; j < result.unclosed.length; j++) {
          unclosed.push(result.unclosed[j]);
        }

        sanitized.features.push(feature);

        // Add to redis cache
        if (feature.properties.PARCEL_NUM != null) {
          //console.log("Writing " + feature.properties.PARCEL_NUM + " to Redis");
          redis_client.set(
            normalizeParcelNumber(feature.properties.PARCEL_NUM),
            JSON.stringify(feature),
          );
        }

        if (feature.properties.NUMBER != null) {
          redis_client.set(
            normalizeAccountNumber(feature.properties.NUMBER),
            JSON.stringify(feature),
          );
        }
      }

      console.log("Finished parsing. Writing file " + file_name + " to S3");

      // Write to S3
      uploadJSONToS3(
        folder_name + "/" + file_name,
        JSON.stringify(sanitized),
        function (err, data) {
          if (err) {
            res.json({ message: "Error: " + err });
            return;
          }
          if (unclosed.length > 0) {
            res.json({
              message:
                "Saved as " +
                file_name +
                ", but unclosed Polygons: " +
                unclosed,
            });
          } else {
            res.json({ message: "The file was saved as " + file_name });
          }
        },
      );
    });

  return;
}

// Get all GeoJSONs
exports.listBook = (req, res, next) => {
  var params = {
    Bucket: S3_BUCKET_NAME,
    Delimiter: "/",
    Prefix: "gis-data-api/books/",
  };

  s3.listObjectsV2(params, (err, data) => {
    var map_files = [];

    if (err) {
      console.error("Unable to list map books from S3:", err);
      return res.json({ num: "ALL", name: "All", books: [] });
    }

    if (!data || !Array.isArray(data.Contents)) {
      console.warn("No map books found in S3:", data);
      return res.json({ num: "ALL", name: "All", books: [] });
    }

    for (var i = 0; i < data.Contents.length; i++) {
      const fileName = data.Contents[i].Key.replace("gis-data-api/books/", "");

      // Skip non JSONs
      if (fileName.indexOf("json") < 0) continue;

      map_files.push(fileName);
    }

    var zone = {};
    zone.num = "ALL";
    zone.name = "All";
    zone.books = map_files;
    res.json(zone);
  });
};
