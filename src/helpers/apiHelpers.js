const request = require('request');

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

/**
 * does http request and returns the response data
 * @param {string} url
 * @return {Promise<{Object}>}
 */
export function makeRequestDetailed(url) {
  return new Promise((resolve, reject) => {
    request(url, function(error, response, body) {
      if (error)
        reject(error);
      else if (response.statusCode === 200) {
        resolve({response, body});
      } else {
        reject(`makeRequestDetailed() - fetch error ${response.statusCode}`);
      }
    });
  });
}

/**
 * does http request and returns the response data parsed from JSON
 * @param {string} url
 * @return {Promise<{Object}>}
 */
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
      } else {
        reject(`makeJsonRequestDetailed() - fetch error ${response.statusCode}`);
      }
    });
  });
}

/**
 * does multipart Catalog next API query and returns data for specific page
 * @param {string} url
 * @param {number} page
 * @return {Promise<{Object}>}
 */
export async function doMultipartQueryPage(url, page = 1) {
  const url_ = `${url}&page=${page}`;
  const {result, response} = await makeJsonRequestDetailed(url_);
  const pos = response && response.rawHeaders && response.rawHeaders.indexOf('X-Total-Count');
  const totalCount = (pos >= 0) ? parseInt(response.rawHeaders[pos + 1]) : 0;
  const items = result && result.data || null;
  return {items, totalCount};
}

/**
 * does multipart Catalog next API query and returns combined data data
 * @param {string} url
 * @return {Promise<{Object}>}
 */
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
 * Request the Door43-Catalog from catalog-next
 * @return {Object} - Catalog from the DCS API
 */
export async function getCatalog() {
  let released;
  let latest;

  try {
    const fetchUrlReleased = 'https://git.door43.org/api/catalog/v5/search/Door43-Catalog?q=Bible%2CAligned%20Bible%2CGreek%20New%20Testament%2CHebrew%20Old%20Testament%2CTranslation%20Words%2CTSV%20Translation%20Notes%2CTranslation%20Academy%2CBible%20translation%20comprehension%20questions%2C&partialMatch=false&limit=50';
    released = await doMultipartQuery(fetchUrlReleased);
    console.log(`released catalog has ${released.length} items`);
    const fetchUrlLatest = `${fetchUrlReleased}&stage=latest`;
    latest = await doMultipartQuery(fetchUrlLatest);
    console.log(`latest catalog has ${latest.length} items`);
  } catch (e) {
    console.log('getCatalog() - error getting catalog', e);
    return [];
  }

  // merge in latest if no released version for repo
  for (const repo of latest) {
    const match = released.find(item => (item.full_name === repo.full_name));
    if (!match) {
      released.push(repo);
    }
  }
  return released;
}

/**
 * does Catalog next API query to get manifest data
 * @param {string} owner
 * @param {string} repo
 * * @return {Promise<{Object}>}
 */
export async function getManifestData(owner, repo) {
  const fetchUrl = `https://git.door43.org/api/catalog/v5/entry/${owner}/${repo}/master/metadata`;
  try {
    const {result} = await makeJsonRequestDetailed(fetchUrl);
    return result && result.dublin_core && result.dublin_core.version;
  } catch (e) {
    console.log('getManifestData() - error getting manifest data', e);
  }
  return null;
}
