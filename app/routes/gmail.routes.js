
module.exports = (app) => {
  const gmail = require("../controllers/gmail.controller.js");


  app.get("/gmail/user", gmail.getUser);
  app.get("/gmail/csvs", gmail.getCsvs);
};
