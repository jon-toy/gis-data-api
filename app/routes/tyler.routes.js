// Routes for the Tools Front End
module.exports = (app) => {
  const tyler = require("../controllers/tyler.controller.js");

  // Get a row from a CSV that's been uploaded for Tyler data
  app.get("/tyler/data", tyler.getTylerData);

  // Post a CSV containing Tyler data
  app.post("/tyler/data", tyler.postTylerData);
};
