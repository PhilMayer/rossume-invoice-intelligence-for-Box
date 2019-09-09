const fs = require('fs');
const axios = require('axios');
const request = require('request');

const MAX_RETRIES = 30;
const WAIT_PERIOD = 5000;
const DOCUMENT_API = 'https://all.rir.rossum.ai/document';

// A complete list of possible fields can be found at https://rossum.ai/developers/api/field_types
const METADATA_TARGETS = [
    "invoice_id", "customer_id", "date_issue", "date_due", "terms", 
    "amount_total", "amount_paid", "amount_due", "sender_name", 
    "recipient_name", "tax_detail_total", "order_id"
]

// async timeout function
const timeout = (ms) => new Promise(res => setTimeout(res, ms))

class Rossum {

    constructor() {
        this.headers = { 'Authorization': `secret_key ${process.env.ROSSUM_SECRET_KEY}`};
    }

    // Upload document to Rossum
    async uploadFiletoRossum(filePath) {
        let readStream = fs.createReadStream(filePath);

        const options = {
            method: 'POST',
            url: DOCUMENT_API,
            headers: {
                'Content-type': 'multipart/form-data',
                'Access-Control-Allow-Origin': '*',
                'Authorization': this.headers.Authorization
            }
        }

        return new Promise((resolve, reject) => {
            const req = request(options, (error, response, body) => {
                if (error) {
                    console.log(error.body);
                    reject(error);
                }
                resolve(JSON.parse(body));
            });

            const form = req.form();
            form.append('file', readStream);
        })
    }

    // Check if Rossum model is done processing document
    async waitForDocumentExtraction(id) {
        let retryCount = 0;
        let status;

        while(status !== 'ready' && retryCount <= MAX_RETRIES) {
            retryCount++;
            await timeout(WAIT_PERIOD);
            status = await this.getDocumentStatus(id); 
        }

        return status;
    }

    async getDocumentStatus(id) {
        const doc = await axios.get(`${DOCUMENT_API}/${id}`, {headers: this.headers});
        return doc.data.status;
    }

    // Fetch fields detected in document
    async getDocumentFields(id) {
        const doc = await axios.get(`${DOCUMENT_API}/${id}`, {headers: this.headers});
        return doc.data.fields;
    }

    /**
     * Return only the fields we care about.
     * 
     * Rossum will also return multiple results per field, so we keep track of the result 
     * with the highest confidence score for each field (ie instead of ending up with 
     * multiple results for amount_due, we take only the result that is most likely to 
     * actually be the amount_due).
     * 
     */
    processJSON(rossumMetadata) {
        const metadata = {};
        let curField;
        let curScore;
        
        rossumMetadata.forEach((field) => {
            const fieldName = field.name;

            if (METADATA_TARGETS.includes(fieldName)) {
                if (fieldName !== curField) {
                    curField = fieldName;
                    curScore = 0;
                } 

                if (curScore < field.score) {
                    curScore = field.score;
                    let content = field.value;

                    if (fieldName === "date_issue" || fieldName === "date_due") {
                        content = formatDate(content);
                    }
                    metadata[fieldName] = content;
                }
            }
        })

        return metadata;
    }
}

function formatDate(date) {
    const year = date.substr(0,4);
    const month = date.substr(5, 2);
    const day = date.substr(8, 2);

    return `${month}/${day}/${year}`;
}

module.exports = Rossum;