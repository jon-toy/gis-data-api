// Import
const compression = require('compression');
const express = require('express');
const bodyParser = require('body-parser');
const multiparty = require('connect-multiparty');

// Instantiate
const app = express();

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// Multipart post data parser
app.use(multiparty());

// GZIP Compression
app.use(compression());

// Allow CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Routes for maps
require('./app/routes/map.routes.js')(app);

// Static files
app.use(express.static(__dirname + '/public'));

// listen for requests
app.listen(3001, () => {
    console.log("Server is listening on port 3001");
});