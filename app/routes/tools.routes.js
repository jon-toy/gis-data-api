// Routes for the Tools Front End
module.exports = (app) => {
    const tools = require('../controllers/tools.controller.js');

    // Get a collection of books currently in the parcel viewer
    app.get('/tools/parcel-viewer/books', tools.getParcelViewerBooks);

    // Get a collection of zones from the rural address pages
    app.get('/tools/rural-address/zones', tools.getRuralAddressZones);
}