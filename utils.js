const fs = require("fs");

module.exports = function () {
  this.ZONE_BOOK_LIST_KEY_PREFIX = "ZONE_BOOK_LIST_";
  this.BOOK_ZONE_KEY_PREFIX = "BOOK_ZONE_";
  this.PARCEL_ACCOUNT_NUMBER_PREFIX = "ACCOUNT_NUMBER_";
  this.TREASURER_BALANCE_DUE_PREFIX = "TREASURER_BALANCE_DUE_";
  this.BALANCE_DUE_FILENAME = "balance_due_extract.txt";
  this.SHERIFF_EDIT_HISTORY_PREFIX = "SHERIFF_EDIT_HISTORY_";
  this.ZONE_EDIT_HISTORY_PREFIX = "ZONE_EDIT_HISTORY_";
  this.ZONE_ROTATION_PREFIX = "ZONE_ROTATION_";
  this.EDIT_HISTORY_FILENAME = "edit_history.tsv";
  this.TYLER_DATA_FILENAME = "tyler.csv";
  this.TYLER_DATA_PREFIX = "TYLER_DATA_";

  // S3 Access
  const s3Params = JSON.parse(fs.readFileSync(__dirname + "/s3params.json"));

  this.S3_ACCESS = s3Params.accessId;
  this.S3_SECRET = s3Params.secret;
  this.S3_BUCKET_NAME = s3Params.bucketName;

  const AWS = require("aws-sdk");
  const s3 = new AWS.S3({
    accessKeyId: S3_ACCESS,
    secretAccessKey: S3_SECRET,
  });

  this.uploadJSONToS3 = (relativeFilePath, fileContent, uploadCallback) => {
    // Setting up S3 upload parameters
    const params = {
      Bucket: S3_BUCKET_NAME,
      Key: "gis-data-api/" + relativeFilePath,
      Body: fileContent,
    };

    // Uploading files to the bucket
    s3.upload(params, uploadCallback);
  };

  this.uploadFileToS3 = (relativeFilePath, file, uploadCallback) => {
    const key = "gis-data-api/" + relativeFilePath;
    var params = {
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: fs.createReadStream(file.path),
    };
    s3.putObject(params, function (err, data) {
      if (err) {
        console.log("Error at uploadFileToS3 function", err);
      } else {
        uploadCallback(err, data);
      }
    });
  };

  this.normalizeParcelNumber = function (parcel_num) {
    if (parcel_num == null) return null;

    var sanitized_parcel = parcel_num.replace("-", "");
    while (sanitized_parcel.indexOf("-") >= 0) {
      sanitized_parcel = sanitized_parcel.replace("-", ""); // Search ignores hyphens
    }
    sanitized_parcel = sanitized_parcel.toUpperCase(); // Search ignores case

    return sanitized_parcel;
  };

  this.normalizeAccountNumber = function (account_num) {
    if (account_num == null) return null;

    return PARCEL_ACCOUNT_NUMBER_PREFIX + account_num;
  };
};
