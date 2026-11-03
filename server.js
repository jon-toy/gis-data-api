const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor !== 22) {
  console.error(
    `FATAL: this app requires Node 22.x. Current version: ${process.version}. Run: source ~/.nvm/nvm.sh && nvm use 22 && npm start`,
  );
  process.exit(1);
}

// Import
const compression = require("compression");
const express = require("express");
const bodyParser = require("body-parser");
const {
  client: redis_client,
  ensureRedisConnected,
} = require("./redis-client");
const sheriff = require("./app/controllers/sheriff.controller.js");
const tyler = require("./app/controllers/tyler.controller.js");
const s3 = require("./aws-s3-client");
const cors = require("cors");

// Instantiate
const app = express();

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// Do not parse multipart uploads globally; Formidable handles those routes directly.

// GZIP Compression
app.use(compression());

//Allow CORS local only
// app.use(function (req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header(
//     "Access-Control-Allow-Headers",
//     "Origin, X-Requested-With, Content-Type, Accept",
//   );
//   next();
// });

const corsOptions = {
  origin: "https://jt.co.apache.az.us",
};

app.use(cors(corsOptions));

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
require("./app/routes/gmail.routes.js")(app);
require("./app/routes/optional-layers.routes.js")(app);

// Static files
app.use(express.static(__dirname + "/public"));

// Utils
require("./utils.js")(app);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const setRedisValueWithTimeout = async (redisKey, value, timeoutMs = 15000) => {
  const setPromise = redis_client.set(redisKey, value);
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      console.error(
        `Redis set timeout after ${timeoutMs}ms for key ${String(redisKey).slice(0, 160)}`,
      );
      reject(new Error(`Redis set timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    setPromise.finally(() => clearTimeout(timer));
  });

  await Promise.race([setPromise, timeoutPromise]);
};

async function writeOptionalLayerValue(redisKey, rawBody, label) {
  const valueToStore =
    typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);

  await setRedisValueWithTimeout(redisKey, valueToStore, 15000);
}

let redisReady = false;

function shouldWarmCacheOnStartup() {
  if (process.env.SKIP_CACHE_WARMUP === "true") {
    return false;
  }

  if (process.env.CACHE_WARMUP === "true") {
    return true;
  }

  return false;
}

async function ensureRedisReady() {
  try {
    await ensureRedisConnected();
    redisReady = true;
    if (shouldWarmCacheOnStartup()) {
      console.log("Starting cache warmup sequence");
      setImmediate(() => {
        loadCacheOnStartup()
          .then(() => {
            console.log("Cache warmup sequence complete");
            console.log("All Startup Complete");
          })
          .catch((err) => {
            console.error("Cache warmup sequence failed:", err);
          });
      });
    } else {
      console.log(
        "Cache warmup disabled by default to protect low-memory production hosts. Set CACHE_WARMUP=true only for a deliberate cache rebuild.",
      );
      console.log("All Startup Complete");
    }
  } catch (err) {
    console.error("Redis startup warmup failed:", err);
    console.warn(
      "Continuing without Redis cache warmup so the API can still start. " +
        "Set CACHE_WARMUP=true to enable it explicitly.",
    );
    console.log("All Startup Complete");
  }
}

// Start listening immediately so local development is not blocked by the Redis warmup.
app.listen(3001, () => {
  console.log("Server is listening on port 3001");
});

ensureRedisReady();

async function loadCacheOnStartup() {
  const loaders = [
    () => loadCacheZones(),
    () => loadCacheParcels(),
    () => loadCacheSheriffEditHistory(),
    () => loadCacheSheriffRotation(),
    () => loadCacheTylerData(),
    () => loadCacheOptionalLayersTrs(),
    () => loadCacheOptionalLayersVoter(),
    () => loadCacheOptionalLayersVDistrict(),
    () => loadCacheOptionalLayersZip(),
    () => loadCacheOptionalLayersBkr(),
  ];

  const summary = [];

  for (const [index, loader] of loaders.entries()) {
    const loaderName =
      [
        "loadCacheZones",
        "loadCacheParcels",
        "loadCacheSheriffEditHistory",
        "loadCacheSheriffRotation",
        "loadCacheTylerData",
        "loadCacheOptionalLayersTrs",
        "loadCacheOptionalLayersVoter",
        "loadCacheOptionalLayersVDistrict",
        "loadCacheOptionalLayersZip",
        "loadCacheOptionalLayersBkr",
      ][index] || `loader-${index}`;

    try {
      console.log(`Starting cache warmup: ${loaderName}`);
      const startedAt = Date.now();
      await loader();
      const elapsedMs = Date.now() - startedAt;
      summary.push({ name: loaderName, elapsedMs });
      console.log(`Finished cache warmup: ${loaderName} in ${elapsedMs}ms`);
      await delay(250);
    } catch (err) {
      summary.push({
        name: loaderName,
        elapsedMs: null,
        error: err.message || String(err),
      });
      console.error(`Cache loader failed: ${loaderName}`, err);
    }
  }

  console.log("Cache warmup summary:");
  for (const entry of summary) {
    if (entry.elapsedMs == null) {
      console.log(`- ${entry.name}: failed (${entry.error})`);
    } else {
      console.log(`- ${entry.name}: ${entry.elapsedMs}ms`);
    }
  }
  console.log("Background cache warmup finished");

  async function loadCacheZones() {
    await loadZone(
      1,
      "Sanders",
      ["207.json", "209.json", "210.json"],
      35.1518,
      -109.5042,
      13,
    );
    await loadZone(
      2,
      "Sanders South",
      ["205.json", "206.json", "208.json", "211.json"],
      34.951286499999995,
      -109.44762600000001,
      13,
    );
    await loadZone(3, "St John's North", ["204.json"], 34.7501, -109.1778, 13);
    await loadZone(
      4,
      "Concho",
      ["201.json", "212.json"],
      34.5180075,
      -109.69512700000001,
      13,
    );
    await loadZone(
      5,
      "St John's",
      ["108.json", "202.json", "203.json"],
      34.384599,
      -109.29469749999998,
      13,
    );
    await loadZone(
      6,
      "Vernon",
      ["106.json", "107.json"],
      34.2367455,
      -109.68258000000003,
      13,
    );
    await loadZone(
      7,
      "Springerville/Eagar",
      ["101.json", "102.json", "103.json", "104.json", "105.json"],
      34.1096,
      -109.2906,
      13,
    );

    async function loadZone(
      num,
      name,
      books,
      starting_lat,
      starting_lon,
      starting_zoom,
    ) {
      var zone = {};
      zone.num = num;
      zone.name = name;
      zone.books = books;
      zone.starting_lat = starting_lat;
      zone.starting_lon = starting_lon;
      zone.starting_zoom = starting_zoom;

      if (!redisReady) return;

      var key = ZONE_BOOK_LIST_KEY_PREFIX + zone.num;
      await setRedisValueWithTimeout(key, JSON.stringify(zone), 15000);

      // Load book to zone keys
      for (var i = 0; i < books.length; i++) {
        var book_name = books[i].replace(".json", "");
        var book_key = BOOK_ZONE_KEY_PREFIX + book_name;
        await setRedisValueWithTimeout(book_key, String(num), 15000);
      }
    }
  }

  function loadCacheParcels() {
    return new Promise((resolve) => {
      var params = {
        Bucket: S3_BUCKET_NAME,
        Delimiter: "/",
        Prefix: "gis-data-api/books/",
      };

      async function writeRedisEntries(entries, s3Key) {
        const chunkSize = 250;
        for (let start = 0; start < entries.length; start += chunkSize) {
          const chunk = entries.slice(start, start + chunkSize);
          for (const { redisKey, value } of chunk) {
            try {
              await setRedisValueWithTimeout(redisKey, value, 15000);
            } catch (error) {
              console.error(
                `Parcel warmup write failed for ${s3Key} key ${redisKey}:`,
                error && error.message ? error.message : error,
              );
            }
          }
        }
      }

      s3.listObjectsV2(params, async (err, data) => {
        if (err) {
          console.error("S3 listObjectsV2 failed:", err);
          resolve();
          return;
        }

        if (!data || !Array.isArray(data.Contents)) {
          console.error("Unexpected S3 response:", data);
          resolve();
          return;
        }

        const parcelFiles = data.Contents.filter(
          (item) => item.Key.indexOf("json") >= 0,
        );
        let totalRedisEntriesWritten = 0;
        let completedParcelFiles = 0;

        for (let i = 0; i < parcelFiles.length; i++) {
          const s3Key = parcelFiles[i].Key;

          try {
            const fileData = await new Promise((innerResolve, innerReject) => {
              s3.getObject(
                { Bucket: S3_BUCKET_NAME, Key: s3Key },
                (getErr, body) => {
                  if (getErr != null) {
                    innerReject(getErr);
                    return;
                  }
                  innerResolve(body);
                },
              );
            });

            if (!fileData || fileData.Body == null) {
              console.warn(`Parcel warmup skipping empty body for ${s3Key}`);
              continue;
            }

            const rawBody = fileData.Body.toString();
            if (!rawBody || !rawBody.trim()) {
              console.warn(`Parcel warmup skipping empty JSON for ${s3Key}`);
              continue;
            }

            let obj;
            try {
              obj = JSON.parse(rawBody);
            } catch (parseErr) {
              console.warn(
                `Parcel warmup invalid JSON in ${s3Key}:`,
                parseErr.message,
              );
              continue;
            }

            if (!obj || !Array.isArray(obj.features)) {
              console.warn(
                `Parcel warmup skipping non-feature payload for ${s3Key}`,
              );
              continue;
            }

            const writeQueue = [];
            const sampleParcelIds = [];
            let fileRedisEntriesWritten = 0;

            const flushWriteQueue = async () => {
              if (writeQueue.length === 0) return;

              const batch = writeQueue.splice(0, writeQueue.length);
              await writeRedisEntries(batch, s3Key);

              fileRedisEntriesWritten += batch.length;
              totalRedisEntriesWritten += batch.length;
            };

            for (let j = 0; j < obj.features.length; j++) {
              const feature = obj.features[j];
              if (
                !feature ||
                !feature.properties ||
                feature.properties.PARCEL_NUM == null
              ) {
                continue;
              }

              const parcelLabel = String(
                feature.properties.PARCEL_NUM ??
                  feature.properties.NUMBER ??
                  `feature-${j}`,
              );
              const key = normalizeParcelNumber(feature.properties.PARCEL_NUM);
              const stringified = JSON.stringify(feature);

              writeQueue.push({
                redisKey: key,
                value: stringified,
                parcelLabel,
              });
              if (sampleParcelIds.length < 5) {
                sampleParcelIds.push(parcelLabel);
              }

              if (feature.properties.NUMBER != null) {
                writeQueue.push({
                  redisKey: normalizeAccountNumber(feature.properties.NUMBER),
                  value: stringified,
                  parcelLabel,
                });
              }

              if (writeQueue.length >= 250) {
                await flushWriteQueue();
              }
            }

            await flushWriteQueue();

            console.log(
              `Parcel warmup writing ${fileRedisEntriesWritten} Redis entries for ${s3Key}; sample parcel ids=${sampleParcelIds.join(", ") || "n/a"}`,
            );

            completedParcelFiles += 1;
            console.log(
              `Finished parcel warmup file ${s3Key}; total processed files=${completedParcelFiles}/${parcelFiles.length}; total Redis entries written=${totalRedisEntriesWritten}`,
            );
          } catch (fileError) {
            console.error(`Parcel warmup failed for ${s3Key}:`, fileError);
          }
        }

        console.log(
          `Completed parcel cache warmup for ${parcelFiles.length} files; total Redis entries written=${totalRedisEntriesWritten}`,
        );
        resolve();
      });
    });
  }

  function loadCacheSheriffEditHistory() {
    return sheriff.readEditHistoryIntoMemory(
      __dirname + "/public/ruraladdress",
    );
  }

  function loadCacheSheriffRotation() {
    return sheriff.readRotationIntoMemory(
      __dirname + "/public/ruraladdress/rotation",
    );
  }

  function loadCacheTylerData() {
    return tyler.readTylerDataIntoMemory();
  }

  function loadCacheOptionalLayersTrs() {
    return new Promise((resolve) => {
      var params = {
        Bucket: S3_BUCKET_NAME,
        Delimiter: "/",
        Prefix: "gis-data-api/optional-layers/trs/",
      };

      s3.listObjectsV2(params, async (err, data) => {
        if (err) {
          console.error(
            "S3 listObjectsV2 failed for optional layers TRS:",
            err,
          );
          resolve();
          return;
        }

        if (!data || !Array.isArray(data.Contents)) {
          console.error(
            "Unexpected S3 response for optional layers TRS:",
            data,
          );
          resolve();
          return;
        }

        for (const item of data.Contents) {
          if (item.Key.indexOf("json") < 0) continue;

          const s3Key = item.Key;
          const filename = s3Key.split("/").pop();
          const id = filename.replace(".json", "");
          const redis_key = OPTIONAL_LAYERS_TRS_PREFIX + id;

          await new Promise((innerResolve) => {
            s3.getObject(
              { Bucket: S3_BUCKET_NAME, Key: s3Key },
              async function (err, data) {
                try {
                  if (err != null) {
                    console.log(err);
                    innerResolve();
                    return;
                  }

                  if (!data || data.Body == null) {
                    console.warn(
                      "Skipping optional layer payload with empty S3 body:",
                      data,
                    );
                    innerResolve();
                    return;
                  }

                  const rawBody =
                    data && data.Body != null ? data.Body.toString() : "";
                  if (!rawBody || !rawBody.trim()) {
                    innerResolve();
                    return;
                  }

                  JSON.parse(rawBody);
                  await writeOptionalLayerValue(redis_key, rawBody, "TRS");
                  innerResolve();
                } catch (parseErr) {
                  console.warn(
                    "Skipping optional layer payload with invalid JSON:",
                    data && data.Key,
                    parseErr.message,
                  );
                  innerResolve();
                }
              },
            );
          });
        }

        resolve();
      });
    });
  }

  function loadCacheOptionalLayersVoter() {
    return new Promise((resolve) => {
      var params = {
        Bucket: S3_BUCKET_NAME,
        Delimiter: "/",
        Prefix: "gis-data-api/optional-layers/voter/",
      };

      s3.listObjectsV2(params, async (err, data) => {
        if (err) {
          console.error(
            "S3 listObjectsV2 failed for optional layers Voter:",
            err,
          );
          resolve();
          return;
        }

        if (!data || !Array.isArray(data.Contents)) {
          console.error(
            "Unexpected S3 response for optional layers Voter:",
            data,
          );
          resolve();
          return;
        }

        for (const item of data.Contents) {
          if (item.Key.indexOf("json") < 0) continue;

          const redis_key = OPTIONAL_LAYERS_VOTER_PREFIX;
          await new Promise((innerResolve) => {
            s3.getObject(
              { Bucket: S3_BUCKET_NAME, Key: item.Key },
              async function (err, data) {
                try {
                  if (err != null) {
                    console.log(err);
                    innerResolve();
                    return;
                  }

                  if (!data || data.Body == null) {
                    console.warn(
                      "Skipping Voter layer payload with empty S3 body:",
                      data,
                    );
                    innerResolve();
                    return;
                  }

                  const rawBody =
                    data && data.Body != null ? data.Body.toString() : "";
                  if (!rawBody || !rawBody.trim()) {
                    innerResolve();
                    return;
                  }

                  JSON.parse(rawBody);
                  await writeOptionalLayerValue(redis_key, rawBody, "VOTER");
                  innerResolve();
                } catch (parseErr) {
                  console.warn(
                    "Skipping Voter layer payload with invalid JSON:",
                    data && data.Key,
                    parseErr.message,
                  );
                  innerResolve();
                }
              },
            );
          });
        }

        resolve();
      });
    });
  }

  function loadCacheOptionalLayersVDistrict() {
    return new Promise((resolve) => {
      var params = {
        Bucket: S3_BUCKET_NAME,
        Delimiter: "/",
        Prefix: "gis-data-api/optional-layers/vdistrict/",
      };

      s3.listObjectsV2(params, async (err, data) => {
        if (err) {
          console.error(
            "S3 listObjectsV2 failed for optional layers VDistrict:",
            err,
          );
          resolve();
          return;
        }

        if (!data || !Array.isArray(data.Contents)) {
          console.error(
            "Unexpected S3 response for optional layers VDistrict:",
            data,
          );
          resolve();
          return;
        }

        for (const item of data.Contents) {
          if (item.Key.indexOf("json") < 0) continue;
          const redis_key = OPTIONAL_LAYERS_VDISTRICT_PREFIX;

          await new Promise((innerResolve) => {
            s3.getObject(
              { Bucket: S3_BUCKET_NAME, Key: item.Key },
              async function (err, data) {
                try {
                  if (err != null) {
                    console.log(err);
                    innerResolve();
                    return;
                  }

                  if (!data || data.Body == null) {
                    console.warn(
                      "Skipping VDistrict payload with empty S3 body:",
                      data,
                    );
                    innerResolve();
                    return;
                  }

                  const rawBody =
                    data && data.Body != null ? data.Body.toString() : "";
                  if (!rawBody || !rawBody.trim()) {
                    innerResolve();
                    return;
                  }

                  JSON.parse(rawBody);
                  await writeOptionalLayerValue(
                    redis_key,
                    rawBody,
                    "V District",
                  );
                  innerResolve();
                } catch (parseErr) {
                  console.warn(
                    "Skipping VDistrict payload with invalid JSON:",
                    data && data.Key,
                    parseErr.message,
                  );
                  innerResolve();
                }
              },
            );
          });
        }

        resolve();
      });
    });
  }

  function loadCacheOptionalLayersZip() {
    return new Promise((resolve) => {
      var params = {
        Bucket: S3_BUCKET_NAME,
        Delimiter: "/",
        Prefix: "gis-data-api/optional-layers/zip/",
      };

      s3.listObjectsV2(params, async (err, data) => {
        if (err) {
          console.error(
            "S3 listObjectsV2 failed for optional layers Zip:",
            err,
          );
          resolve();
          return;
        }

        if (!data || !Array.isArray(data.Contents)) {
          console.error(
            "Unexpected S3 response for optional layers Zip:",
            data,
          );
          resolve();
          return;
        }

        for (const item of data.Contents) {
          if (item.Key.indexOf("json") < 0) continue;
          const redis_key = OPTIONAL_LAYERS_ZIP_PREFIX;

          await new Promise((innerResolve) => {
            s3.getObject(
              { Bucket: S3_BUCKET_NAME, Key: item.Key },
              async function (err, data) {
                try {
                  if (err != null) {
                    console.log(err);
                    innerResolve();
                    return;
                  }

                  if (!data || data.Body == null) {
                    console.warn(
                      "Skipping Zip layer payload with empty S3 body:",
                      data,
                    );
                    innerResolve();
                    return;
                  }

                  const rawBody =
                    data && data.Body != null ? data.Body.toString() : "";
                  if (!rawBody || !rawBody.trim()) {
                    innerResolve();
                    return;
                  }

                  JSON.parse(rawBody);
                  await writeOptionalLayerValue(redis_key, rawBody, "Zip");
                  innerResolve();
                } catch (parseErr) {
                  console.warn(
                    "Skipping Zip layer payload with invalid JSON:",
                    data && data.Key,
                    parseErr.message,
                  );
                  innerResolve();
                }
              },
            );
          });
        }

        resolve();
      });
    });
  }

  function loadCacheOptionalLayersBkr() {
    return new Promise((resolve) => {
      var params = {
        Bucket: S3_BUCKET_NAME,
        Delimiter: "/",
        Prefix: "gis-data-api/optional-layers/bkr/",
      };

      s3.listObjectsV2(params, async (err, data) => {
        if (err) {
          console.error(
            "S3 listObjectsV2 failed for optional layers BKR:",
            err,
          );
          resolve();
          return;
        }

        if (!data || !Array.isArray(data.Contents)) {
          console.error(
            "Unexpected S3 response for optional layers BKR:",
            data,
          );
          resolve();
          return;
        }

        for (const item of data.Contents) {
          if (item.Key.indexOf("json") < 0) continue;
          const redis_key = OPTIONAL_LAYERS_BKR_PREFIX;

          await new Promise((innerResolve) => {
            s3.getObject(
              { Bucket: S3_BUCKET_NAME, Key: item.Key },
              async function (err, data) {
                try {
                  if (err != null) {
                    console.log(err);
                    innerResolve();
                    return;
                  }

                  if (!data || data.Body == null) {
                    console.warn(
                      "Skipping BKR layer payload with empty S3 body:",
                      data,
                    );
                    innerResolve();
                    return;
                  }

                  const rawBody =
                    data && data.Body != null ? data.Body.toString() : "";
                  if (!rawBody || !rawBody.trim()) {
                    innerResolve();
                    return;
                  }

                  JSON.parse(rawBody);
                  await writeOptionalLayerValue(redis_key, rawBody, "BKR");
                  innerResolve();
                } catch (parseErr) {
                  console.warn(
                    "Skipping BKR layer payload with invalid JSON:",
                    data && data.Key,
                    parseErr.message,
                  );
                  innerResolve();
                }
              },
            );
          });
        }

        resolve();
      });
    });
  }
}
