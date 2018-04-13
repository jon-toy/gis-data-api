module.exports = (app) => {
    const maps = require('../controllers/map.controller.js');

    // Convert a new Map
    app.post('/maps', maps.convert);

    // Retrieve all Maps
    app.get('/list', maps.list);
}