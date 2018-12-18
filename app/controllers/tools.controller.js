require('../../utils.js')();

var fs = require('fs');

// Scan a file directory and return an array of available books for the Parcel Viewer
exports.getParcelViewerBooks = (req, res, next) => {
    var folder = __dirname + "/../../public/books/";
    var ret = [];	
    fs.readdir(folder, (err, files) => {
		files.forEach(file => {
            if (file == ".DS_Store") return;
            var obj = {
                name: file
            };

            ret.push(obj);
        });

        var response = {};
        response.books = ret;
        res.send(response);
    });
};

exports.getRuralAddressZones = (req, res, next) => {
    var folder = __dirname + "/../../public/transportation/zones/";
    var ret = [];	
    fs.readdir(folder, (err, files) => {
		files.forEach(file => {
            if (file == ".DS_Store") return;
            var obj = {
                name: file
            };

            ret.push(obj);
        });

        var response = {};
        response.zones = ret;
        res.send(response);
    });
};