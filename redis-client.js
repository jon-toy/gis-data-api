const redis = require("redis");

const client = redis.createClient({
  socket: {
    connectTimeout: 30000,
    socketTimeout: 0,
    keepAlive: 30000,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return false;
      }
      return 500 * retries;
    },
  },
});

client.on("connect", () => {
  console.log("Redis connected");
});

client.on("reconnecting", () => {
  console.warn("Redis reconnecting...");
});

client.on("ready", () => {
  console.log("Redis ready");
});

client.on("error", (err) => {
  const message = err && err.message ? err.message : String(err);
  console.error("Redis Client Error", message);
});

client.on("end", () => {
  console.warn("Redis connection closed");
});

async function ensureRedisConnected() {
  if (client.isOpen || client.isConnecting) {
    return client;
  }

  try {
    await client.connect();
  } catch (err) {
    if (err && err.code === "ERR_REDIS_CONNECTION_CLOSED") {
      console.warn("Redis connection was closed; retrying connect...");
      await client.connect();
    } else {
      throw err;
    }
  }

  return client;
}

const reconnectingCommands = new Set(["get", "set", "keys", "del", "exists"]);
for (const methodName of reconnectingCommands) {
  const originalMethod = client[methodName].bind(client);
  client[methodName] = (...args) => {
    if (client.isOpen || client.isConnecting) {
      return originalMethod(...args);
    }

    return ensureRedisConnected().then(() => originalMethod(...args));
  };
}

module.exports = {
  client,
  ensureRedisConnected,
};
