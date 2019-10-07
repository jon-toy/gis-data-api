module.exports = (app) => {
    const firecontacts = require('../controllers/firecontacts.controller.js');

    // Update all Fire Contacts
    app.post('/fire-contacts/contacts', firecontacts.update);

    // Get all Fire Contacts
    app.get('/fire-contacts/contacts', firecontacts.list);
}