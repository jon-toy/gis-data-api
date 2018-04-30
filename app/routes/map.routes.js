module.exports = (app) => {
    const maps = require('../controllers/map.controller.js');

    // Convert a new Book
    app.post('/books', maps.convertBook);

    // Retrieve all Books
    app.get('/books', maps.listBook);
}