require('../../utils.js')();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.findParcelsForZone = (req, res, next) => {
    findForZone(req, res, "parcels.json");
}

exports.findMarkersForZone = (req, res, next) => {
    findForZone(req, res, "markers.json");
}

exports.findRoadsForZone = (req, res, next) => {
    findForZone(req, res, "roads.json");
}

function findForZone(req, res, file) {
    const zone = req.params.zone;
    if (!zone) {
        var error = {};
        error.error_message = file + " not found.";
        return res.status(404).send(error);
    }

    // Assemble Key
    const key = 'gis-data-api/transportation/zones/' + zone + '/' + file;

    s3.getObject({ Bucket: S3_BUCKET_NAME, Key: key }, function(err, data) {
        // Handle any error and exit
        if (err) {
            var error = {};
            error.err = file + " not found for zone " + zone + ".";
            return res.status(404).send(error);
        }
        
        res.send(JSON.parse(data.Body.toString()));
    })
}