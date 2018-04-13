// Import
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

// Routes for maps
require('./app/routes/map.routes.js')(app);

// Static files
app.use(express.static('public'));

// listen for requests
app.listen(3001, () => {
    console.log("Server is listening on port 3001");
});