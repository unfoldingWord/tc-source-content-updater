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

/**
 * @param {Object} resource - The metadata of the resource being requested
 * @return {string} - The usfm3 content given from the specified resouce
 */
export function downloadResource(resource) {
  const resourcePath = resource.some_attribute;
  return makeRequest(DCS_API + resourcePath);
}

/**
 * @param {Array} resourceList - Array of resources to retrieve from the API
 * @return {Array} - Array of objects of the downloaded resources unformatted
 */
export function downloadResources(resourceList) {
  const content = [];
  // Loop through each resource and download the data
  resourceList.forEach(async resource => {
    const resourceData = await downloadResource(resource);
    content.push(resourceData);
  });
  return content;
}
