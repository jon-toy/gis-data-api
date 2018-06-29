module.exports = (app) => {
    const sheriff = require('../controllers/sheriff.controller.js');

    // Post a tab delimited file containing all the account balances
    app.post('/sheriff/edit-history', sheriff.convertEditReport);

    // Retrieve edit history object for a specific account
    app.get('/sheriff/edit-history/:apn', sheriff.getEditHistory);
}