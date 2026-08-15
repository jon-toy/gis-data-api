require("../../utils.js")();

var redis = require("redis");
var redis_client = redis.createClient();

exports.getOptionalLayersTrs = (req, res, next) => {
  if (!req.params.zoneNum) {
    res.status(400).json({ error: true, msg: "No Zone Number provided" });
    return;
  }

  redis_client.get(
    OPTIONAL_LAYERS_TRS_PREFIX + req.params.zoneNum,
    (err, result) => {
      // Convert from string to JSON
      result = JSON.parse(result);
      res.send(result);
    },
  );
};

exports.getOptionalLayersVoter = (req, res, next) => {
  redis_client.get(OPTIONAL_LAYERS_VOTER_PREFIX, (err, result) => {
    // Convert from string to JSON
    result = JSON.parse(result);
    res.send(result);
  });
};
