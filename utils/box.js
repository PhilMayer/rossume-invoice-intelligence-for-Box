
const fs = require('fs')
const TEMP_PATH = '/tmp/temp.pdf'

var BoxSDK = require('box-node-sdk');
var jsonConfig = require('../config.json');
var sdk = BoxSDK.getPreconfiguredInstance(jsonConfig);

var client = sdk.getAppAuthClient('enterprise');
const USER_ID = '1958091740'
client.asUser(USER_ID);

class Box {

  constructor(filesReader, body) {
    const eventBody = JSON.parse(body);
    this.fileId = eventBody.source.id;
    this.filesReader = filesReader;
  }

  /**
   * Download Document from Box using the Skills Kit FilesReader class.
   */
  async downloadFileFromBox() {
    // get box file read stream and write to local temp file
    const readStream = await this.filesReader.getContentStream();
    const writeStream = fs.createWriteStream(TEMP_PATH);
    const stream = readStream.pipe(writeStream);

    // wait for stream write to 'finish'
    await new Promise((resolve, reject) => {
      stream.on('finish', function () {
          resolve()
        });
    });

    return TEMP_PATH;
  }

  /**
   * Attach skills metadata to file using the Skills Kit skillsWriter class.
   */
  async attachMetadataCard(rossumJson) {
    console.log("FILE ID:", this.fileId);

    const metadataValues = createMetadataJSON(rossumJson);
    const result = await client.files.addMetadata(this.fileId, client.metadata.scopes.ENTERPRISE, "invoicedetails", metadataValues);
    console.log("RESULT:", result);
  }
}

function createMetadataJSON(rossumJson) {
  const metadata = {
    invoiceNumber: "", 
    customerNumber: "",
    issueDate: "",
    dueDate: "", 
    terms: "",
    totalAmount: "",
    amountPaid: "", 
    amountDue: "", 
    senderName: "", 
    recipientName: "",
    taxTotal: "",
    orderNumber: ""
  };

  const keywords = {
        "invoice_id": "invoiceNumber",
        "customer_id": "customerNumber",
        "date_issue": "issueDate",
        "date_due": "dueDate",
        "terms": "terms",
        "amount_total": "totalAmount",
        "amount_paid": "amountPaid",
        "amount_due": "amountDue",
        "sender_name": "senderName",
        "recipient_name": "recipientName",
        "tax_detail_total": "taxTotal",
        "order_id": "orderNumber"
      }
  Object.keys(keywords).forEach((key) => {
    if (rossumJson[key]) {
      metadata[keywords[key]] = rossumJson[key];
    }
  });

  return metadata;
}

module.exports = Box;
