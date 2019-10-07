

// Update all Fire Contacts
const request = require('request');
const admin = require("firebase-admin");
var serviceAccount = require("../../apachecountyfirecontact-firebase-adminsdk-rpwly-7322c88f60.json");

admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
databaseURL: "https://apachecountyfirecontact.firebaseio.com"
});

var db = admin.database();
var ref = db.ref("fire/contacts");

exports.update = (req, res, next) => {
    ref.set(req.body);
    res.send({success:"true"});
};

// Get all Fire Contacts
exports.list = (req, res, next) => {
    // Attach an asynchronous callback to read the data at our posts reference
    ref.on("value", function(snapshot) {
        res.send(snapshot.val());
    }, function (errorObject) {
        res.status(500).send("The read failed: " + errorObject.code);
    });
};