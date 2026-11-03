require("../../utils.js")();
const s3 = require("../../aws-s3-client");

exports.getBook = (req, res) => {
  var book_num = req.params.bookNum;
  var key =
    "gis-data-api/books/" +
    book_num +
    (book_num.indexOf(".json") >= 0 ? "" : ".json");
  console.log(key);
  s3.getObject({ Bucket: S3_BUCKET_NAME, Key: key }, function (err, data) {
    if (!err) res.json(JSON.parse(data.Body.toString()));
    else res.json({ message: "Error: " + err });
  });
};
