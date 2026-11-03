const fs = require("fs");
const http = require("http");
const https = require("https");
const { Readable } = require("stream");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

const s3Params = JSON.parse(fs.readFileSync(__dirname + "/s3params.json"));

const s3Client = new S3Client({
  region: process.env.AWS_REGION || s3Params.region || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS || s3Params.accessId,
    secretAccessKey: process.env.S3_SECRET || s3Params.secret,
  },
  requestHandler: new NodeHttpHandler({
    httpAgent: new http.Agent({ keepAlive: true, maxSockets: 20 }),
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 20 }),
    socketAcquisitionWarningTimeout: 5000,
  }),
});

async function streamToBuffer(stream) {
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function normalizeS3Body(data) {
  if (!data) {
    return data;
  }

  const normalized = { ...data };
  const body = normalized.Body;

  if (body == null) {
    return {
      ...normalized,
      Body: Buffer.alloc(0),
      createReadStream: () => Readable.from([]),
    };
  }

  if (Buffer.isBuffer(body)) {
    return {
      ...normalized,
      Body: body,
      createReadStream: () => Readable.from(body),
    };
  }

  if (body instanceof Uint8Array) {
    const bodyBuffer = Buffer.from(body);
    return {
      ...normalized,
      Body: bodyBuffer,
      createReadStream: () => Readable.from(bodyBuffer),
    };
  }

  if (typeof body === "string") {
    const bodyBuffer = Buffer.from(body);
    return {
      ...normalized,
      Body: bodyBuffer,
      createReadStream: () => Readable.from(bodyBuffer),
    };
  }

  if (typeof body === "object") {
    if (typeof body.pipe === "function") {
      const bodyBuffer = await streamToBuffer(body);
      return {
        ...normalized,
        Body: bodyBuffer,
        createReadStream: () => Readable.from(bodyBuffer),
      };
    }

    if (typeof body[Symbol.asyncIterator] === "function") {
      const bodyBuffer = await streamToBuffer(body);
      return {
        ...normalized,
        Body: bodyBuffer,
        createReadStream: () => Readable.from(bodyBuffer),
      };
    }
  }

  const fallback = Buffer.from(String(body));
  return {
    ...normalized,
    Body: fallback,
    createReadStream: () => Readable.from(fallback),
  };
}

function callWithCallback(promise, callback) {
  if (!callback) {
    return promise;
  }

  promise
    .then((data) => normalizeS3Body(data))
    .then((normalized) => callback(null, normalized))
    .catch((err) => callback(err, null));

  return undefined;
}

function createLegacyGetObjectRequest(params, callback) {
  const request = {
    createReadStream() {
      const stream = new Readable({
        read() {
          s3Client
            .send(new GetObjectCommand(params))
            .then((data) => {
              const body = data && data.Body;
              if (!body) {
                this.push(null);
                return;
              }
              if (Buffer.isBuffer(body)) {
                this.push(body);
                this.push(null);
                return;
              }
              if (body instanceof Uint8Array) {
                this.push(Buffer.from(body));
                this.push(null);
                return;
              }
              if (typeof body.pipe === "function") {
                body.on("data", (chunk) => this.push(chunk));
                body.on("end", () => this.push(null));
                body.on("error", (err) => this.destroy(err));
                return;
              }
              if (typeof body[Symbol.asyncIterator] === "function") {
                (async () => {
                  for await (const chunk of body) {
                    this.push(
                      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
                    );
                  }
                  this.push(null);
                })().catch((err) => this.destroy(err));
                return;
              }
              if (typeof body === "string") {
                this.push(Buffer.from(body));
                this.push(null);
                return;
              }
              this.push(null);
            })
            .catch((err) => this.destroy(err));
        },
      });
      return stream;
    },
  };

  if (typeof callback === "function") {
    s3Client
      .send(new GetObjectCommand(params))
      .then((data) => callback(null, normalizeS3Body(data)))
      .catch((err) => callback(err, null));
  }

  return request;
}

module.exports = {
  listObjectsV2(params, callback) {
    return callWithCallback(
      s3Client.send(new ListObjectsV2Command(params)),
      callback,
    );
  },
  getObject(params, callback) {
    return createLegacyGetObjectRequest(params, callback);
  },
  putObject(params, callback) {
    return callWithCallback(
      s3Client.send(new PutObjectCommand(params)),
      callback,
    );
  },
  upload(params, callback) {
    return callWithCallback(
      new Upload({ client: s3Client, params }).done(),
      callback,
    );
  },
};
