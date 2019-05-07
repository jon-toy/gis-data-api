module.exports = (app) => {
    const ruralAddresses = require('../controllers/ruraladdress.controller.js');

    // Post a Rural Address Fileset
    app.post('/rural-addresses', ruralAddresses.postZone);

    // Overwrite an exsiting zone
    app.put('/rural-addresses/:zoneName', ruralAddresses.putZone);

    // Get a list of the edit history zones available (no parcel data, just meta data)
    app.get('/rural-addresses/edit-history', ruralAddresses.getZonesEditHistory);

    // Get a collection of all the edit history for this zone (with parcel data)
    app.get('/rural-addresses/edit-history/:zoneName', ruralAddresses.getZoneEditHistory);

    // Get the marker label rotations for this zone
    app.get('/rural-addresses/rotations/:zoneName', ruralAddresses.getZoneRotations);

    // Get the meta data for all zone files
    app.get('/rural-addresses/meta-data', ruralAddresses.getMetaData);
}