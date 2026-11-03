const { client: redis_client } = require("../../redis-client");

const ZONE_BOOK_LIST_KEY_PREFIX = "ZONE_BOOK_LIST_";

// Find a list of books for a given zone
exports.findBooksForZone = async (req, res) => {
  var zone_num = req.params.zoneNum;
  var key = ZONE_BOOK_LIST_KEY_PREFIX + zone_num;

  try {
    const result = await redis_client.get(key);

    if (result == null)
      return res.status(404).send("Zone " + zone_num + " Not Found");

    return res.send(JSON.parse(result));
  } catch (error) {
    console.error("Unable to load books for zone:", zone_num, error);
    return res.status(500).json({ error: true, msg: "Unable to load zone books" });
  }
};

// Find a zone for a given book
exports.findZoneForBook = async (req, res) => {
  var book_num = req.params.bookNum;
  var key = BOOK_ZONE_KEY_PREFIX + book_num;

  try {
    const result = await redis_client.get(key);

    if (result == null) {
      var error = {};
      error.error_message = "Zone for Book " + book_num + " Not Found";
      return res.status(404).send(error);
    }

    var response = {};
    response.zone = result;
    return res.send(response);
  } catch (error) {
    console.error("Unable to load zone for book:", book_num, error);
    return res.status(500).json({ error: true, msg: "Unable to load zone" });
  }
};
