module.exports = (app) => {
    const parcels = require('../controllers/parcel.controller.js');

    // Get a single parcel
    app.get('/parcels/:parcelNum', parcels.findOneParcel);
    app.get('/accounts/:accountNum', parcels.findOneParcelByAccountNumber);
}