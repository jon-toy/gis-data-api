require("../../utils.js")();

const { client: redis_client } = require("../../redis-client");

exports.getOptionalLayersTrs = async (req, res, next) => {
  if (!req.params.zoneNum) {
    res.status(400).json({ error: true, msg: "No Zone Number provided" });
    return;
  }

  try {
    const result = await redis_client.get(OPTIONAL_LAYERS_TRS_PREFIX + req.params.zoneNum);
    if (result == null) {
      return res.status(404).json({ error: true, msg: "Optional layer not found" });
    }
    return res.send(JSON.parse(result));
  } catch (error) {
    console.error("Unable to load optional layer TRS:", req.params.zoneNum, error);
    return res.status(500).json({ error: true, msg: "Unable to load optional layer" });
  }
};

exports.getOptionalLayersVoter = async (req, res, next) => {
  try {
    const result = await redis_client.get(OPTIONAL_LAYERS_VOTER_PREFIX);
    if (result == null) {
      return res.status(404).json({ error: true, msg: "Optional layer not found" });
    }
    return res.send(JSON.parse(result));
  } catch (error) {
    console.error("Unable to load optional layer voter", error);
    return res.status(500).json({ error: true, msg: "Unable to load optional layer" });
  }
};

exports.getOptionalLayersVDistrict = async (req, res, next) => {
  try {
    const result = await redis_client.get(OPTIONAL_LAYERS_VDISTRICT_PREFIX);
    if (result == null) {
      return res.status(404).json({ error: true, msg: "Optional layer not found" });
    }
    console.log("Got optional Layer VD");
    return res.send(JSON.parse(result));
  } catch (error) {
    console.error("Unable to load optional layer VDistrict", error);
    return res.status(500).json({ error: true, msg: "Unable to load optional layer" });
  }
};

exports.getOptionalLayersZip = async (req, res, next) => {
  try {
    const result = await redis_client.get(OPTIONAL_LAYERS_ZIP_PREFIX);
    if (result == null || result === "") {
      return res.status(404).json({ error: true, msg: "Optional layer not found" });
    }

    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch (parseError) {
      console.error("Invalid ZIP optional layer payload in Redis:", parseError.message);
      return res.status(500).json({ error: true, msg: "Optional layer payload is invalid" });
    }

    return res.send(parsed);
  } catch (error) {
    console.error("Unable to load optional layer zip", error);
    return res.status(500).json({ error: true, msg: "Unable to load optional layer" });
  }
};

exports.getOptionalLayersBkr = async (req, res, next) => {
  try {
    const result = await redis_client.get(OPTIONAL_LAYERS_BKR_PREFIX);
    if (result == null) {
      return res.status(404).json({ error: true, msg: "Optional layer not found" });
    }
    return res.send(JSON.parse(result));
  } catch (error) {
    console.error("Unable to load optional layer BKR", error);
    return res.status(500).json({ error: true, msg: "Unable to load optional layer" });
  }
};
