module.exports = (app) => {
    const books = require('../controllers/books.controller.js');

    // Get a book by book Number
    app.get('/books/:bookNum', books.getBook);
}