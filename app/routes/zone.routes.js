module.exports = (app) => {
    const zones = require('../controllers/zone.controller.js');

    // Get a list of the books for the zone number
    app.get('/books/zone/:zoneNum', zones.findBooksForZone);
}