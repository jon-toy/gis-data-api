const axios = require("axios");
const { google } = require("googleapis");
const fs = require("fs");
const Readable = require("stream").Readable;
require("../../utils.js")();
const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const tyler = require("./tyler.controller.js");

const oAuth2Client = new google.auth.OAuth2(
  GOOGLEAUTH.clientId,
  GOOGLEAUTH.clientSecret,
  GOOGLEAUTH.redirectUri
);
oAuth2Client.setCredentials({ refresh_token: GOOGLEAUTH.refreshToken });

const generateConfig = (url, accessToken) => {
  return {
    method: "get",
    url: url,
    headers: {
      Authorization: `Bearer ${accessToken} `,
      "Content-type": "application/json",
    },
  };
};

// async function sendMail(req, res) {
//   try {
//     const accessToken = await oAuth2Client.getAccessToken();
//     const transport = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         ...CONSTANTS.auth,
//         accessToken: accessToken,
//       },
//     });
//     const mailOptions = {
//       ...CONSTANTS.mailoptions,
//       text: "The Gmail API with NodeJS works",
//     };
//     const result = await transport.sendMail(mailOptions);
//     res.send(result);
//   } catch (error) {
//     console.log(error);
//     res.send(error);
//   }
// }

async function getUser(req, res) {
  try {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/profile`;
    const { token } = await oAuth2Client.getAccessToken();
    const config = generateConfig(url, token);
    const response = await axios(config);
    res.json(response.data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
}

async function getCsvs(req, res) {
  try {
    const QUERY = `after:2022/9/25 has:attachment OR has:drive`;
    let url = `https://www.googleapis.com/gmail/v1/users/me/messages?q=${QUERY}`;
    const { token } = await oAuth2Client.getAccessToken();
    let config = generateConfig(url, token);
    let response = await axios(config);
    messages = response.data.messages;

    if (messages.length <= 0) {
      res.send({});
      return;
    }

    let messagesFull = [];
    for (var i = 0; i < messages.length; i++) {
      url = `https://www.googleapis.com/gmail/v1/users/me/messages/${messages[i].id}`;
      config = generateConfig(url, token);
      let response = await axios(config);
      messagesFull.push(response.data);
    }

    let attachmentIds = {};
    let biggest = 0;
    for (var i = 0; i < messagesFull.length; i++) {
      for (var j = 0; j < messagesFull[i].payload.parts.length; j++) {
        if (messagesFull[i].payload.parts[j].filename.indexOf(".csv") >= 0) {
          const date = messagesFull[i].internalDate;
          if (date >= biggest) {
            // Get the latest one
            biggest = date;
            attachmentIds = {
              attachmentId: messagesFull[i].payload.parts[j].body.attachmentId,
              messageId: messagesFull[i].id,
              date,
            };
          }
        }
      }
    }

    // Get the last updated from S3 and see if the attachment is bigger. If so, update
    var params = {
      Bucket: S3_BUCKET_NAME,
      Delimiter: "/",
      Prefix: "gis-data-api/tyler/",
    };

    s3.listObjectsV2(params, (err, data) => {
      for (var i = 0; i < data.Contents.length; i++) {
        // Skip any file not called tyler.csv
        var file = data.Contents[i].Key.replace("gis-data-api/tyler/", "");
        if (file.indexOf("tyler.csv") < 0) continue;

        if (Date.parse(data.Contents[i].LastModified) >= biggest) {
          console.log(
            "S3 file is newer than email attachment. Skipping. Attachment Time: " +
              biggest +
              " S3 Last Modified: " +
              Date.parse(data.Contents[i].LastModified)
          );
          res.send({});
          return;
        }

        // Email attachment is newer than what's in S3, so let's update
        url = `https://www.googleapis.com/gmail/v1/users/me/messages/${attachmentIds.messageId}/attachments/${attachmentIds.attachmentId}`;
        config = generateConfig(url, token);
        axios(config).then((response) => {
          const dataBuffer = Buffer.from(response.data.data, "base64");

          var s = new Readable();

          s.push(dataBuffer);
          s.push(null);

          uploadStreamToS3("tyler/" + TYLER_DATA_FILENAME, s, () => {
            tyler.readTylerDataIntoMemory();
            res.send({ success: true });
          });
        });
      }
    });
  } catch (error) {
    console.log(error);
    res.send(error);
  }
}

async function getDrafts(req, res) {
  try {
    const url = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/drafts`;
    const { token } = await oAuth2Client.getAccessToken();
    const config = generateConfig(url, token);
    const response = await axios(config);
    res.json(response.data);
  } catch (error) {
    console.log(error);
    return error;
  }
}

async function searchMail(req, res) {
  try {
    const url = `https://www.googleapis.com/gmail/v1/users/me/messages?q=${req.params.search}`;
    const { token } = await oAuth2Client.getAccessToken();
    const config = generateConfig(url, token);
    const response = await axios(config);
    console.log(response);
    res.json(response.data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
}

module.exports = {
  getUser,
  getCsvs,
};
