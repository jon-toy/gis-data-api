

// Update all Fire Contacts
const request = require('request');
exports.update = (req, res, next) => {
    console.log(req.body);
    request.put({
        url: 'https://apachecountyfirecontact.firebaseio.com/fire/contacts.json', 
        form: JSON.stringify(req.body),
        headers: {
            'Content-Type': 'application/json'
        }
    }, (err,response,body) => {
        console.log(err);
        console.log(response);
        console.log(body);
        res.send(JSON.parse(body));
    })
};

// Get all Fire Contacts
exports.list = (req, res, next) => {
    request.get('https://apachecountyfirecontact.firebaseio.com/fire/contacts.json', (err,response,body) => {
        res.send(JSON.parse(response.body));
    })
};