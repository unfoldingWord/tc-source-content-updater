var request = require('request');
const DCS_API = 'https://api.door43.org';
const CATALOG_PATH = '/v3/catalog.json';

/**
 * @param {string} url - Url of the get request to make
 * @return {Promise} - parsed body from the response
 */
export function makeRequest(url) {
  return new Promise((resolve, reject) => {
    request(url, function(error, response, body) {
      if (error)
        reject(error);
      else if (response.statusCode === 200) {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

/**
 * @return {Object} - Catalog from the DCS API
 */
export function getCatalog() {
  return makeRequest(DCS_API + CATALOG_PATH);
}
