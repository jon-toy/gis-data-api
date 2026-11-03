const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor !== 22) {
  console.error(
    `FATAL: this cache rebuild script requires Node 22.x. Current version: ${process.version}. Run: source ~/.nvm/nvm.sh && nvm use 22 && node warm-cache.js`,
  );
  process.exit(1);
}

require("./utils.js")();

const s3 = require("./aws-s3-client");
const {
  client: redis_client,
  ensureRedisConnected,
} = require("./redis-client");
const sheriff = require("./app/controllers/sheriff.controller.js");
const tyler = require("./app/controllers/tyler.controller.js");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WRITE_BATCH_SIZE = 25;
const WRITE_PAUSE_MS = 50;

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
  await delay(WRITE_PAUSE_MS);
};

async function loadCacheZones() {
  const zoneDefinitions = [
    {
      num: 1,
      name: "Sanders",
      books: ["207.json", "209.json", "210.json"],
      lat: 35.1518,
      lon: -109.5042,
      zoom: 13,
    },
    {
      num: 2,
      name: "Sanders South",
      books: ["205.json", "206.json", "208.json", "211.json"],
      lat: 34.951286499999995,
      lon: -109.44762600000001,
      zoom: 13,
    },
    {
      num: 3,
      name: "St John's North",
      books: ["204.json"],
      lat: 34.7501,
      lon: -109.1778,
      zoom: 13,
    },
    {
      num: 4,
      name: "Concho",
      books: ["201.json", "212.json"],
      lat: 34.5180075,
      lon: -109.69512700000001,
      zoom: 13,
    },
    {
      num: 5,
      name: "St John's",
      books: ["108.json", "202.json", "203.json"],
      lat: 34.384599,
      lon: -109.29469749999998,
      zoom: 13,
    },
    {
      num: 6,
      name: "Vernon",
      books: ["106.json", "107.json"],
      lat: 34.2367455,
      lon: -109.68258000000003,
      zoom: 13,
    },
    {
      num: 7,
      name: "Springerville/Eagar",
      books: ["101.json", "102.json", "103.json", "104.json", "105.json"],
      lat: 34.1096,
      lon: -109.2906,
      zoom: 13,
    },
  ];

  for (const zone of zoneDefinitions) {
    const payload = {
      num: zone.num,
      name: zone.name,
      books: zone.books,
      starting_lat: zone.lat,
      starting_lon: zone.lon,
      starting_zoom: zone.zoom,
    };

    await setRedisValueWithTimeout(
      ZONE_BOOK_LIST_KEY_PREFIX + zone.num,
      JSON.stringify(payload),
      15000,
    );

    for (const bookName of zone.books) {
      const bookKey = bookName.replace(".json", "");
      await setRedisValueWithTimeout(
        BOOK_ZONE_KEY_PREFIX + bookKey,
        String(zone.num),
        15000,
      );
    }
  }
}

async function loadCacheParcels() {
  return new Promise((resolve) => {
    const params = {
      Bucket: S3_BUCKET_NAME,
      Delimiter: "/",
      Prefix: "gis-data-api/books/",
    };

    s3.listObjectsV2(params, async (err, data) => {
      if (err) {
        console.error("S3 listObjectsV2 failed for parcel warmup:", err);
        resolve();
        return;
      }

      if (!data || !Array.isArray(data.Contents)) {
        console.error("Unexpected S3 response for parcel warmup:", data);
        resolve();
        return;
      }

      const parcelFiles = data.Contents.filter(
        (item) => item.Key.indexOf("json") >= 0,
      );
      let totalRedisEntriesWritten = 0;
      let completedParcelFiles = 0;

      for (const parcelFile of parcelFiles) {
        const s3Key = parcelFile.Key;

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
            const redisKey = normalizeParcelNumber(
              feature.properties.PARCEL_NUM,
            );
            const stringified = JSON.stringify(feature);

            writeQueue.push({ redisKey, value: stringified, parcelLabel });
            if (sampleParcelIds.length < 5) sampleParcelIds.push(parcelLabel);

            if (feature.properties.NUMBER != null) {
              writeQueue.push({
                redisKey: normalizeAccountNumber(feature.properties.NUMBER),
                value: stringified,
                parcelLabel,
              });
            }

            if (writeQueue.length >= WRITE_BATCH_SIZE) {
              const batch = writeQueue.splice(0, writeQueue.length);
              for (const entry of batch) {
                await setRedisValueWithTimeout(
                  entry.redisKey,
                  entry.value,
                  15000,
                );
              }
              totalRedisEntriesWritten += batch.length;
            }
          }

          if (writeQueue.length > 0) {
            const batch = writeQueue.splice(0, writeQueue.length);
            for (const entry of batch) {
              await setRedisValueWithTimeout(
                entry.redisKey,
                entry.value,
                15000,
              );
            }
            totalRedisEntriesWritten += batch.length;
          }

          completedParcelFiles += 1;
          console.log(
            `Parcel warmup writing ${totalRedisEntriesWritten} Redis entries for ${s3Key}; sample parcel ids=${sampleParcelIds.join(", ") || "n/a"}`,
          );
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

async function runWarmCache() {
  console.log("Connecting to Redis for cache rebuild...");
  await ensureRedisConnected();
  console.log("Redis connected and ready for cache rebuild");

  const loaders = [
    { name: "loadCacheZones", fn: loadCacheZones },
    { name: "loadCacheParcels", fn: loadCacheParcels },
    {
      name: "loadCacheSheriffEditHistory",
      fn: async () => {
        await sheriff.readEditHistoryIntoMemory(__dirname + "/public/ruraladdress");
        await delay(250);
      },
    },
    {
      name: "loadCacheSheriffRotation",
      fn: async () => {
        await sheriff.readRotationIntoMemory(
          __dirname + "/public/ruraladdress/rotation",
        );
        await delay(250);
      },
    },
    {
      name: "loadCacheTylerData",
      fn: async () => {
        await tyler.readTylerDataIntoMemory();
        await delay(250);
      },
    },
  ];

  for (const loader of loaders) {
    console.log(`Starting cache warmup: ${loader.name}`);
    const startedAt = Date.now();
    try {
      await loader.fn();
      console.log(
        `Finished cache warmup: ${loader.name} in ${Date.now() - startedAt}ms`,
      );
    } catch (err) {
      console.error(`Cache loader failed: ${loader.name}`, err);
    }
    await delay(250);
  }

  console.log("Cache warmup complete");
  process.exit(0);
}

if (require.main === module) {
  runWarmCache().catch((err) => {
    console.error("Cache warmup script failed:", err);
    process.exit(1);
  });
}

module.exports = { runWarmCache };
