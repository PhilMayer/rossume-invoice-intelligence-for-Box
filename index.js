const Box = require('./utils/box.js')
const Rossum = require('./utils/rossum.js');
const { FilesReader, SkillsWriter, SkillsErrorEnum } = require('./skills-kit-2.0');

/**
 * This is the main function that the Lambda will call when invoked.
 */
module.exports.handler = async (triggeredEvent, context, callback) => {
  const { body } = triggeredEvent;
  const filesReader = new FilesReader(body);

  if (isValidEvent(triggeredEvent)) {
    await processEvent(filesReader, body, callback);
  } else {
    callback(null, { statusCode: 200, body: 'Event received but invalid' });
  }
};

function isValidEvent(triggeredEvent) {
  return triggeredEvent.body
};

async function processEvent(filesReader, body, finalCallback) {
  const box = new Box(filesReader, body);

  try {  
    const tempFilePath = await box.downloadFileFromBox();
    const rossumMetadata = await sendToRossum(tempFilePath)

    await box.attachMetadataCard(rossumMetadata); // process Rossum json object and attach Box Skills card as metadata
    console.log('Successfully attached Skills metadata to Box file');

    finalCallback(null, { statusCode: 200, body: 'It was a resounding success.' });
      
  } catch (error) {
      console.log(error);
      finalCallback(null, { statusCode: 200, body: 'Unknown error occurred somewhere along the line.' });
  }
}

async function sendToRossum(filePath) {
  const rossum = new Rossum();

  const uploadedFile = await rossum.uploadFiletoRossum(filePath);
  const invoiceId = uploadedFile.id;
  console.log('Successfully uploaded to Rossum');

  await rossum.waitForDocumentExtraction(invoiceId);
  console.log('Rossum data extraction complete');

  const fields = await rossum.getDocumentFields(invoiceId);
  console.log('Fetched Rossum data');

  return rossum.processJSON(fields);
}