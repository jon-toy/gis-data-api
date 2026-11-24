const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const shapefile = require("shapefile");
const proj4 = require("proj4");

function findFile(directory, extension) {
  const wanted = extension.toLowerCase();
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findFile(fullPath, wanted);
      if (nested) return nested;
    } else if (path.extname(entry.name).toLowerCase() === wanted) {
      return fullPath;
    }
  }

  return null;
}

function transformCoordinates(coordinates, transformer) {
  if (!Array.isArray(coordinates)) return coordinates;
  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    const transformed = transformer.forward([coordinates[0], coordinates[1]]);
    return [transformed[0], transformed[1], ...coordinates.slice(2)];
  }

  return coordinates.map((coordinate) =>
    transformCoordinates(coordinate, transformer),
  );
}

async function convertShapefileArchive(zipPath) {
  const extractionDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "gis-shapefile-"),
  );

  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractionDirectory, true);

    const shpPath = findFile(extractionDirectory, ".shp");
    if (!shpPath) {
      throw new Error("ZIP archive does not contain a .shp file");
    }

    const basePath = shpPath.slice(0, -4);
    const dbfPath = fs.existsSync(`${basePath}.dbf`)
      ? `${basePath}.dbf`
      : findFile(extractionDirectory, ".dbf");

    if (!dbfPath) {
      throw new Error("ZIP archive does not contain a matching .dbf file");
    }

    const prjPath = fs.existsSync(`${basePath}.prj`)
      ? `${basePath}.prj`
      : findFile(extractionDirectory, ".prj");

    let transformer = null;
    if (prjPath && fs.existsSync(prjPath)) {
      const prj = fs.readFileSync(prjPath, "utf8").trim();
      if (prj) {
        try {
          transformer = proj4(prj, "EPSG:4326");
        } catch (error) {
          console.warn(
            "Unable to initialize PRJ coordinate transform:",
            error.message,
          );
        }
      }
    }

    const source = await shapefile.open(shpPath, dbfPath);
    const features = [];

    while (true) {
      const result = await source.read();
      if (result.done) break;

      const feature = result.value;
      if (transformer && feature && feature.geometry) {
        feature.geometry.coordinates = transformCoordinates(
          feature.geometry.coordinates,
          transformer,
        );
      }
      features.push(feature);
    }

    return {
      type: "FeatureCollection",
      features,
    };
  } finally {
    fs.rmSync(extractionDirectory, { recursive: true, force: true });
  }
}

async function convertLocalFile(filePath, originalName = "") {
  const extension = path.extname(originalName || filePath).toLowerCase();

  if (extension === ".zip") {
    return convertShapefileArchive(filePath);
  }

  if (extension === ".json" || extension === ".geojson") {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (parsed.type === "FeatureCollection") return parsed;
    if (parsed.type && parsed.coordinates) {
      return {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: parsed }],
      };
    }
    throw new Error(
      "JSON file is not a valid GeoJSON FeatureCollection or geometry",
    );
  }

  throw new Error(`Unsupported upload type: ${extension || "unknown"}`);
}

module.exports = { convertLocalFile };
