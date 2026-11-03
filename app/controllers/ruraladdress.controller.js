require("../../utils.js")();
var sheriff = require("./sheriff.controller.js");

// Convert to a GeoJSON
var superagent_request = require("superagent");
var { IncomingForm } = require("formidable");
var fs = require("fs");
const { client: redis_client } = require("../../redis-client");
const s3 = require("../../aws-s3-client");

const UPLOAD_PASSWORD = "apache_county_eggdrop1315";

// Take in a set of 3 files (Markers, Parcels, Roads) and store them on disk
exports.postZone = (req, res, next) => {
  return handleResponse(req, res);
};

exports.putZone = (req, res, next) => {
  return handleResponse(req, res);
};

exports.getZoneEditHistory = async (req, res, next) => {
  if (!req.params.zoneName) {
    res.status(400).json({ error: true, msg: "No Zone Name provided" });
    return;
  }

  try {
    const result = await redis_client.get(ZONE_EDIT_HISTORY_PREFIX + req.params.zoneName);
    if (result == null) {
      return res.status(404).json({ error: true, msg: "Zone edit history not found" });
    }

    let parsedResult = JSON.parse(result);

    if (req.query.startDate) {
      var startDate = new Date(req.query.startDate);

      parsedResult = parsedResult.map((parcel) => {
        parcel.edits = parcel.edits.filter((edit) => {
          editDate = new Date(edit.date);
          return editDate >= startDate;
        });
        return parcel;
      });

      parsedResult = parsedResult.filter((parcel) => parcel.edits.length > 0);
    }

    if (req.query.endDate) {
      var endDate = new Date(req.query.endDate);

      parsedResult = parsedResult.map((parcel) => {
        parcel.edits = parcel.edits.filter((edit) => {
          editDate = new Date(edit.date);
          return editDate <= endDate;
        });
        return parcel;
      });

      parsedResult = parsedResult.filter((parcel) => parcel.edits.length > 0);
    }
    return res.send(parsedResult);
  } catch (error) {
    console.error("Unable to load zone edit history:", req.params.zoneName, error);
    return res.status(500).json({ error: true, msg: "Unable to load zone edit history" });
  }
};

exports.getZoneRotations = async (req, res, next) => {
  if (!req.params.zoneName) {
    res.status(400).json({ error: true, msg: "No Zone Name provided" });
    return;
  }

  try {
    const result = await redis_client.get(ZONE_ROTATION_PREFIX + req.params.zoneName);
    if (result == null) {
      return res.status(404).json({ error: true, msg: "Zone rotation not found" });
    }

    return res.send(JSON.parse(result));
  } catch (error) {
    console.error("Unable to load zone rotation:", req.params.zoneName, error);
    return res.status(500).json({ error: true, msg: "Unable to load zone rotation" });
  }
};

exports.getZonesEditHistory = (req, res) => {
  const prefix = "gis-data-api/ruraladdress/";

  var params = {
    Bucket: S3_BUCKET_NAME,
    Delimiter: "/",
    Prefix: prefix,
  };

  s3.listObjectsV2(params, (err, data) => {
    var ret = { zones: [] };

    if (err) {
      console.error("Unable to list rural address zones from S3:", err);
      return res.send(ret);
    }

    if (!data || !Array.isArray(data.Contents)) {
      console.warn("No rural address zone metadata found in S3:", data);
      return res.send(ret);
    }

    data.Contents.forEach((file) => {
      var zone = {};
      zone.name = file.Key.replace(prefix, "").replace(".tsv", "");
      zone.lastModified = file.LastModified;
      ret.zones.push(zone);
    });

    res.send(ret);
  });
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

function normalizeFile(file) {
  const candidate = unwrapUploadedFile(file);
  if (!candidate) return null;

  const normalized = { ...candidate };
  normalized.path = normalized.path || normalized.filepath || null;
  normalized.name =
    normalized.name ||
    normalized.originalFilename ||
    normalized.newFilename ||
    "upload";
  return normalized;
}

function handleResponse(req, res) {
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

    if (!fields.zoneName) {
      res.status(400).json({ error: true, msg: "No Zone Name provided" });
      return;
    }

    const folderName = fields.zoneName;

    const markers = normalizeFile(files.markers || files["markers"]);
    const parcels = normalizeFile(files.parcels || files["parcels"]);
    const roads = normalizeFile(files.roads || files["roads"]);
    const water = normalizeFile(files.water || files["water"]);
    const text = normalizeFile(files.text || files["text"]);
    const history = normalizeFile(files.history || files["history"]);
    const rotation = normalizeFile(files.rotation || files["rotation"]);

    const hasNonEmptyFile = (file) => {
      if (!file) return false;
      const candidate = Array.isArray(file) ? file[0] : file;
      return Number(candidate && candidate.size ? candidate.size : 0) > 0;
    };

    if (
      !hasNonEmptyFile(markers) &&
      !hasNonEmptyFile(parcels) &&
      !hasNonEmptyFile(roads) &&
      !hasNonEmptyFile(water) &&
      !hasNonEmptyFile(text) &&
      !hasNonEmptyFile(history) &&
      !hasNonEmptyFile(rotation)
    ) {
      res.status(400).json({ error: true, msg: "No file provided" });
      return;
    }

    var password = fields.password;

    if (password != UPLOAD_PASSWORD)
      return res.json({ message: "Invalid Password" });

    const firstNonEmpty = (file) => {
      if (!file) return null;
      return Array.isArray(file)
        ? file.find(
            (entry) => Number(entry && entry.size ? entry.size : 0) > 0,
          ) || file[0]
        : file;
    };

    const markerFile = firstNonEmpty(markers);
    const parcelFile = firstNonEmpty(parcels);
    const waterFile = firstNonEmpty(water);
    const roadFile = firstNonEmpty(roads);
    const textFile = firstNonEmpty(text);
    const historyFile = firstNonEmpty(history);
    const rotationFile = firstNonEmpty(rotation);

    if (markerFile) convertAndWrite(folderName, "markers.json", markerFile);
    if (parcelFile) convertAndWrite(folderName, "parcels.json", parcelFile);
    if (waterFile) convertAndWrite(folderName, "water.json", waterFile);
    if (roadFile) convertAndWrite(folderName, "roads.json", roadFile);
    if (textFile) convertAndWrite(folderName, "text.json", textFile);

    if (historyFile) handleEditHistory(folderName, historyFile);
    if (rotationFile) handleRotation(folderName, rotationFile);

    return res.json({ message: "Writing in directory " + folderName });
  });
}

function convertAndWrite(folderName, fileName, data) {
  const filePath = data && (data.path || data.filepath);

  superagent_request
    .post("http://ogre.adc4gis.com/convert")
    .field("sourceSrs", "")
    .field("targetSrs", "")
    .attach(
      "upload",
      filePath,
      data &&
        (data.originalFilename || data.name || data.newFilename || fileName),
    )
    .end(function (er, res) {
      if (er) return console.error(er);

      uploadJSONToS3(
        "transportation/zones/" + folderName + "/" + fileName,
        JSON.stringify(res.body),
        function (err) {
          if (err) {
            return console.log(err);
          }
        },
      );
    });
}

function handleEditHistory(fileName, file) {
  const filePath = file && (file.path || file.filepath);

  // Write to S3
  uploadFileAtPathToS3(
    "ruraladdress/" + fileName + ".tsv",
    filePath,
    function (err, data) {
      if (!err) sheriff.readEditHistoryIntoMemory(filePath);
      else console.error(err);
    },
  );
}

function handleRotation(fileName, file) {
  const filePath = file && (file.path || file.filepath);
  const rotationDir = __dirname + "/../../public/ruraladdress/rotation";

  // Write to S3
  uploadFileAtPathToS3(
    "ruraladdress/rotation" + fileName + ".tsv",
    filePath,
    function (err, data) {
      if (!err) sheriff.readRotationIntoMemory(rotationDir);
      else console.error(err);
    },
  );
}

exports.getMetaData = (req, res) => {
  var zoneFolder = __dirname + "/../../public/transportation/zones";

  const zones_prefix = "gis-data-api/transportation/zones/";
  var params = {
    Bucket: S3_BUCKET_NAME,
  };

  // Get all objects in a bucket
  s3.listObjectsV2(params, (err, data) => {
    var files = [];

    if (err) {
      console.error("Unable to list rural address zones from S3:", err);
      return res.send([]);
    }

    if (!data || !Array.isArray(data.Contents)) {
      console.warn("No rural address zone files found in S3:", data);
      return res.send([]);
    }

    // Get all the files that are part of the zones folder
    data.Contents.forEach((object) => {
      const key = object.Key;
      if (key.indexOf(zones_prefix) < 0) return;

      files.push(object);
    });

    var zones = [];

    // Get all unique zone names
    files.forEach((object) => {
      let zone = object.Key.replace(zones_prefix, "");
      zone = zone.substring(0, zone.indexOf("/"));
      if (zones.indexOf(zone) < 0) zones.push(zone);
    });

    var ret = [];

    // For each zone, get all the files for it and create an object for the return object
    zones.forEach((zone) => {
      var zoneRet = {};
      zoneRet.name = zone;
      zoneRet.files = [];
      // Get all the files for this zone
      files
        .filter((object) => object.Key.indexOf(zones_prefix + zone) >= 0)
        // Create a file object for this zone
        .forEach((filteredObject) => {
          var zoneFile = {};
          zoneFile.name = filteredObject.Key.replace(
            zones_prefix + zone + "/",
            "",
          );
          zoneFile.lastModified = filteredObject.LastModified;
          zoneRet.files.push(zoneFile);
        });
      ret.push(zoneRet);
    });

    res.send(ret);
  });
};
