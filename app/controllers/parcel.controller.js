require("../../utils.js")();

const { client: redis_client } = require("../../redis-client");

// Find a single parcel with a parcelNum
exports.findOneParcel = async (req, res) => {
  var parcel_num = req.params.parcelNum;
  parcel_num = normalizeParcelNumber(parcel_num);

  try {
    const result = await redis_client.get(parcel_num);

    if (result == null) {
      var error = {};
      error.error_message = "Parcel " + parcel_num + " not found.";
      return res.status(404).send(error);
    }

    // Convert to object
    const parsedResult = JSON.parse(result);

    // Augment parcel with additional data
    return augmentData(parsedResult, (augmented) => {
      res.send(augmented);
    });
  } catch (error) {
    console.error("Unable to load parcel by parcel number:", parcel_num, error);
    return res.status(500).json({ error: true, msg: "Unable to load parcel" });
  }
};

// Find a single parcel with an account number
exports.findOneParcelByAccountNumber = async (req, res) => {
  var account_num = req.params.accountNum;
  account_num = normalizeAccountNumber(account_num);

  try {
    const result = await redis_client.get(account_num);

    if (result == null) {
      var error = {};
      error.error_message =
        "Parcel with account number " + account_num + " not found.";
      return res.status(404).send(error);
    }

    const parsedResult = JSON.parse(result);

    // Augment parcel with additional data
    return augmentData(parsedResult, (augmented) => {
      res.send(augmented);
    });
  } catch (error) {
    console.error("Unable to load parcel by account number:", account_num, error);
    return res.status(500).json({ error: true, msg: "Unable to load parcel" });
  }
};

function augmentData(parcel, callback) {
  // Add Tyler Data

  callback(parcel);

  return parcel;
}
