import {delay} from './utils';

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

/**
 * Request the catalog.json from DCS API
 * @return {Object} - Catalog from the DCS API
 */
export function getCatalogOld() {
  return makeRequest(DCS_API + PIVOTED_CATALOG_PATH);
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
export async function getD43Catalog() {
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
 * searching with a max number of retries
 * @param {array} subjects
 * @param {number} retries
 * @return {Promise<*>}
 */
async function searchWithRetry(subjects, retries=3) {
  let result_;
  for (let i = 1; i <= retries; i++) {
    try {
      const subjectParam = encodeURI(subjects.join(','));
      const owner = `Door43-Catalog`;
      const fetchUrl = `https://git.door43.org/api/catalog/v3/search?owner=${owner}&subject=${subjectParam}`;
      const {result} = await makeJsonRequestDetailed(fetchUrl);
      result_ = result && result;
      break;
    } catch (e) {
      if (i >= retries) {
        throw e;
      }
      await delay(500);
    }
  }
  return result_;
}

/**
 * get published catalog using catalog next v3
 * @return {Promise<*[]>}
 */
export async function getCatalogAllReleases() {
  const released = [];
  const subjectList = ['Bible', 'Aligned Bible', 'Greek New Testament', 'Hebrew Old Testament', 'Translation Words', 'TSV Translation Notes', 'Translation Academy', 'Bible translation comprehension questions'];
  // const subjectList = ['Bible', 'Testament', 'Translation Words', 'TSV Translation Notes', 'Translation Academy'];

  try {
    // for (const subject of subjectList) {
    const result = await searchWithRetry(subjectList);
    let repos = 0;
    const languages = result && result.languages || [];
    for (const language of languages) {
        const languageId = language.identifier;
        const resources = language.resources || [];
        for (const resource of resources) {
          resource.language = languageId;
          released.push(resource);
          repos++;
        }
      }
      console.log(`has ${repos} items`);
    // }
    console.log(`released catalog has ${released.length} items`);
  } catch (e) {
    console.log('getCatalog() - error getting catalog', e);
    return [];
  }

  return released;
}

/**
 * get published catalog
 * @return {Promise<*[]>}
 */
export async function getCatalog() {
  return getCatalogAllReleases();
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
    return result;
  } catch (e) {
    console.log('getManifestData() - error getting manifest data', e);
  }
  return null;
}
