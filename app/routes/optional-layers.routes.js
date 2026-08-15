module.exports = (app) => {
  const optionalLayers = require("../controllers/optional-layers.controller.js");

  // TRS
  app.get("/optional-layers/trs/:zoneNum", optionalLayers.getOptionalLayersTrs);

  // Voter
  app.get("/optional-layers/voter", optionalLayers.getOptionalLayersVoter);
};
