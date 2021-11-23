const request = require('request');
const DCS_API = 'https://api.door43.org';
const PIVOTED_CATALOG_PATH = '/v3/subjects/pivoted.json';
/**
 * Performs a get request on the specified url.
 * This function trys to parse the body but if it fails
 * will return the body by itself.
 *
 * @param {string} url - Url of the get request to make
 * @return {Promise} - parsed body from the response
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    request(url, function(error, response, body) {
      if (error)
        reject(error);
      else if (response.statusCode === 200) {
        let result = body;
        try {
          result = JSON.parse(body);
        } catch (e) {
          reject(e);
        }
        resolve(result);
      }
    });
  });
}

export function makeJsonRequestDetailed(url) {
  return new Promise((resolve, reject) => {
    request(url, function(error, response, body) {
      if (error)
        reject(error);
      else if (response.statusCode === 200) {
        let result = body;
        try {
          result = JSON.parse(body);
        } catch (e) {
          reject(e);
        }
        resolve({result, response, body});
      }
    });
  });
}

export async function doMultipartQueryPage(url, page = 1) {
  const url_ = `${url}&page=${page}`;
  const {result, response, body} = await makeJsonRequestDetailed(url_);
  const pos = response && response.rawHeaders && response.rawHeaders.indexOf('X-Total-Count');
  const totalCount = (pos >= 0) ? parseInt(response.rawHeaders[pos + 1]) : 0;
  const items = result && result.data || null;
  return {items, totalCount};
}

export async function doMultipartQuery(url) {
  let page = 1;
  let data = [];
  const {items, totalCount} = await doMultipartQueryPage(url, page);
  let lastItems = items;
  let totalCount_ = totalCount;
  data = data.concat(items);
  while (lastItems && data.length < totalCount_) {
    const {items, totalCount} = await doMultipartQueryPage(url, ++page);
    lastItems = items;
    totalCount_ = totalCount;
    if (items && items.length) {
      data = data.concat(items);
    }
  }

  return data;
}

/**
 * Request the catalog.json from DCS API
 * @return {Object} - Catalog from the DCS API
 */
export function getCatalog() {
  return makeRequest(DCS_API + PIVOTED_CATALOG_PATH);
}
