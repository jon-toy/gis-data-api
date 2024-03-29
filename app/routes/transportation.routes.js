module.exports = (app) => {
  const transportation = require("../controllers/transportation.controller.js");

  // Parcels for Zone
  app.get(
    "/transportation/zones/:zone/parcels.json",
    transportation.findParcelsForZone
  );

  // Markers for Zone
  app.get(
    "/transportation/zones/:zone/markers.json",
    transportation.findMarkersForZone
  );

  // Roads for Zone
  app.get(
    "/transportation/zones/:zone/roads.json",
    transportation.findRoadsForZone
  );

  // Text for Zone
  app.get(
    "/transportation/zones/:zone/text.json",
    transportation.findTextForZone
  );

  // Water for Zone
  app.get(
    "/transportation/zones/:zone/water.json",
    transportation.findWaterForZone
  );
};
