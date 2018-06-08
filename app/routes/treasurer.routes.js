module.exports = (app) => {
    const treasurer = require('../controllers/treasurer.controller.js');

    // Post a text file containing all the account balances
    app.post('/treasurer/account-balance', treasurer.convertAccountBalance);

    // Retrieve account balance for a specific account
    app.get('/treasurer/account-balance/:accountNum', treasurer.getAccountBalance);
}