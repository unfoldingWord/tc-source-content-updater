import {delay} from './utils';
import {SORT, STAGE, SUBJECT} from '../index';
import fs from 'fs-extra';
import path from 'path-extra';
import * as Bible from '../resources/bible';
import {
  cleanReaddirSync,
  getLatestVersionsAndOwners,
  getVersionAndOwnerFromPath,
} from './resourcesHelpers';

const request = require('request');
export const DOOR43_CATALOG = `Door43-Catalog`;
export const TRANSLATION_HELPS = 'translationHelps';
export const EMPTY_TIME = '0001-01-01T00:00:00+00:00';
export const OWNER_SEPARATOR = '_';

/**
 * does http request and returns the response data parsed from JSON
 * @param {string} url
 * @param {number} retries
 * @return {Promise<{Object}>}
 */
export async function makeJsonRequestDetailed(url, retries=5) {
  let result_;
  for (let i = 1; i <= retries; i++) {
    result_ = null;
    try {
      result_ = await new Promise((resolve, reject) => {
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
            reject(`fetch error ${response.statusCode}`);
          }
        });
      });
    } catch (e) {
      if (i >= retries) {
        console.warn('makeJsonRequestDetailed() - error getting manifest data', e);
        throw e;
      }
      result_ = null;
      await delay(500);
      console.log(`makeJsonRequestDetailed() - retry ${i+1} getting manifest data, last error`, e);
    }

    if (result_) {
      break;
    }
  }
  return result_;
}

/**
 * searching subjects
 * @param {array} subjects
 * @param {string} owner
 * @param {number} retries
 * @return {Promise<*>}
 */
async function searchSubjects(subjects, owner, retries=3) {
  const subjectParam = encodeURI(subjects.join(','));
  let fetchUrl = `https://git.door43.org/api/catalog/v3/search?subject=${subjectParam}`;
  if (owner) {
    fetchUrl += fetchUrl + `&owner=${owner}`;
  }
  const {result} = await makeJsonRequestDetailed(fetchUrl, retries);
  return result;
}

/**
 * get published catalog using catalog next v3
 * @return {Promise<*[]>}
 */
export async function getOldCatalogReleases() {
  const released = [];
  const owner = null; // get all owners
  const subjectList = ['Bible', 'Aligned Bible', 'Greek New Testament', 'Hebrew Old Testament', 'Translation Words', 'TSV Translation Notes', 'Translation Academy'];
  // const subjectList = ['Bible', 'Testament', 'Translation Words', 'TSV Translation Notes', 'Translation Academy'];

  try {
    const result = await searchSubjects(subjectList, owner, 5);
    let repos = 0;
    const languages = result && result.languages || [];
    for (const language of languages) {
        const languageId = language.identifier;
        const resources = language.resources || [];
        for (const resource of resources) {
          resource.languageId = languageId;
          resource.resourceId = resource.identifier;
          resource.foundInCatalog = 'OLD';
          resource.full_name = resource.full_name || `${resource.owner}/${resource.repo}`;
          resource.checking_level = resource.checking && resource.checking.checking_level;
          const formats = resource.formats;
          if (formats && formats.length > 1) {
            console.log('too many');
          }
          const firstFormat = formats && formats[0];
          resource.downloadUrl = firstFormat && firstFormat.url;
          released.push(resource);
          repos++;
        }
      }
      console.log(`has ${repos} items`);
    console.log(`released catalog has ${released.length} items`);
  } catch (e) {
    console.error('getCatalog() - error getting catalog', e);
    return [];
  }

  return released;
}

/**
 * get published catalog - combines catalog next releases with old catalog
 * @return {Promise<*[]>}
 */
export async function getCatalog() {
  const catalogReleases = await getOldCatalogReleases();
  const searchParams = {
    subject: SUBJECT.ALL_TC_RESOURCES,
    stage: STAGE.PROD,
  };
  console.log(`found ${catalogReleases.length} items in old catalog`);
  const newCatalogReleases = await searchCatalogNext(searchParams);
  console.log(`found ${newCatalogReleases.length} items in new catalog`);
  // merge catalogs together - catalog new takes precident
  for (const item of newCatalogReleases) {
    const index = catalogReleases.findIndex(oldItem => (item.full_name === oldItem.full_name));
    if (index >= 0) {
      catalogReleases[index] = item; // overwrite item in old catalog
      catalogReleases[index].foundInCatalog = 'NEW+OLD';
    } else {
      catalogReleases.push(item); // add unique item
    }
  }
  console.log(`now ${catalogReleases.length} items in merged catalog, before filter`);
  const catalogReleases_ = catalogReleases.filter(resource => {
    const isGreekOrHebrew = (resource.languageId === Bible.NT_ORIG_LANG && resource.resourceId === Bible.NT_ORIG_LANG_BIBLE) ||
      (resource.languageId === Bible.OT_ORIG_LANG && resource.resourceId === Bible.OT_ORIG_LANG_BIBLE);

    if (isGreekOrHebrew) { // TODO: until we get twl support, we have to restrict original languages
      const isDoor43 = resource.owner === DOOR43_CATALOG;
      if (!isDoor43) {
        return false;
      }
    }

    if (resource.branch_or_tag_name) { // check for version
      const firstChar = resource.branch_or_tag_name[0];
      const isDigit = (firstChar >= '0') && (firstChar <= '9');
      if ((firstChar !== 'v') && !isDigit) {
        return false; // reject if tag is not a version
      }
    }

    return true;
  });
  console.log(`now ${catalogReleases_.length} items in merged catalog`);

  return catalogReleases_;
}

/**
 * add parameter to url string
 * @param {*} value
 * @param {object} parameters
 * @param {string} tag
 * @return {*}
 */
function addUrlParameter(value, parameters, tag) {
  if (value) {
    if (parameters) { // see if we need separator
      parameters += '&';
    }
    parameters += `${tag}=${encodeURIComponent(value)}`;
  }
  return parameters;
}

/**
 * filter for supported repos
 * @param {array} resources
 * @return {*[]}
 */
function getCompatibleResourceList(resources) {
  const supported = [];
  for (const item of resources || []) {
    // add fields for backward compatibility
    const languageId = item.language;
    let [, resourceId] = (item.name || '').split(`${languageId}_`);
    resourceId = resourceId || item.name; // if language was not in name, then use name as resource ID
    item.resourceId = resourceId;
    item.languageId = languageId;
    item.checking_level = item.repo && item.repo.checking_level;
    item.foundInCatalog = 'NEW';
    item.modified = item.modified || item.released;

    if (item.zipball_url) {
      item.downloadUrl = item.zipball_url;
    }
    // check for version. if there is one, it will save having to fetch it from DCS later.
    if (item.release) { // if released
      const tagName = item.release.tag_name;
      if (tagName && (tagName[0] === 'v')) {
        item.version = tagName.substr(1);
      }
    } else {
      const branchOrTagName = item.branch_or_tag_name;
      if (branchOrTagName && (branchOrTagName[0] === 'v')) {
        item.version = branchOrTagName.substr(1);
      }
    }
    if (item.subject) {
      item.subject = item.subject.replaceAll(' ', '_');
    }
    // add supported resources to returned list
    if (item.downloadUrl && item.subject && item.name && item.full_name) {
      supported.push(item);
    }
  }
  return supported;
}

/**
 * @typedef {Object} searchParamsType
 * @property {String} owner - resource owner, if undefined then all are searched
 * @property {String} languageId - language of resource, if undefined then all are searched
 * @property {String} subject - one or more subjects separated by comma. See options defined in SUBJECT.
 *                                  If undefined then all are searched.
 * @property {Number} limit - maximum results to return, default 100
 * @property {String} partialMatch - if true will do case insensitive, substring matching, default is false
 * @property {String} stage - specifies which release stage to be returned out of these stages:
 *                    STAGE.PROD - return only the production releases
 *                    STAGE.PRE_PROD - return the pre-production release if it exists instead of the production release
 *                    STAGE.DRAFT - return the draft release if it exists instead of pre-production or production release
 *                    STAGE.LATEST -return the default branch (e.g. master) if it is a valid RC instead of the "prod", "preprod" or "draft".  (default)
 * @property {Number|String} checkingLevel - search only for entries with the given checking level(s). Can be 1, 2 or 3.  Default is any.
 * @property {String} sort - how to sort results (see defines in SORT), if undefined then sorted by by "lang", then "subject" and then "tag"
 */

/**
 * Method to search for latest resources using catalog next
 * @param {searchParamsType} searchParams - search options
 * @param {number} retries - number of times to retry calling search API, default 3
 * @return {Promise<*[]|null>}
 */
export async function searchCatalogNext(searchParams, retries=3) {
  let result_ = null;
  const {
    owner,
    languageId,
    subject,
    limit = 100,
    stage = STAGE.LATEST,
    checkingLevel,
    partialMatch,
    sort = SORT.REPO_NAME,
  } = searchParams;

  try {
    let fetchUrl = `https://git.door43.org/api/catalog/v5/search`;
    let parameters = '';
    parameters = addUrlParameter(owner, parameters, 'owner');
    parameters = addUrlParameter(languageId, parameters, 'lang');
    parameters = addUrlParameter(subject, parameters, 'subject');
    parameters = addUrlParameter(limit, parameters, 'limit');
    parameters = addUrlParameter(stage, parameters, 'stage');
    parameters = addUrlParameter(checkingLevel, parameters, 'checkingLevel');
    parameters = addUrlParameter(partialMatch, parameters, 'partialMatch');
    parameters = addUrlParameter(sort, parameters, 'sort');
    if (parameters) {
      fetchUrl += '?' + parameters;
    }
    console.log(`Searching: ${fetchUrl}`);
    const {result} = await makeJsonRequestDetailed(fetchUrl, retries);
    result_ = result && result.data;
  } catch (e) {
    console.warn('searchCatalogNext() - error calling search API', e);
    return null;
  }

  const supported = getCompatibleResourceList(result_);
  return supported;
}

/**
 * does Catalog next API query to get manifest data
 * @param {string} owner
 * @param {string} repo
 * @param {number} retries
 * @return {Promise<{Object}>}
 */
export async function downloadManifestData(owner, repo, retries=5) {
  const fetchUrl = `https://git.door43.org/api/catalog/v5/entry/${owner}/${repo}/master/metadata`;
  try {
    const {result} = await makeJsonRequestDetailed(fetchUrl, retries);
    return result;
  } catch (e) {
    console.warn('getManifestData() - error getting manifest data', e);
    throw e;
  }
}


/**
 * get local resources
 * @param {string} resourcesPath
 * @return {null|*[]}
 */
export const getLocalResourceList = (resourcesPath) => {
  try {
    if (!fs.existsSync(resourcesPath)) {
      fs.ensureDirSync(resourcesPath);
    }

    const localResourceList = [];
    const resourceLanguages = fs.readdirSync(resourcesPath)
      .filter((file) => path.extname(file) !== '.json' && file !== '.DS_Store');

    for (let i = 0; i < resourceLanguages.length; i++) {
      const languageId = resourceLanguages[i];
      const biblesPath = path.join(resourcesPath, languageId, 'bibles');
      const tHelpsPath = path.join(resourcesPath, languageId, TRANSLATION_HELPS);
      const bibleIds = cleanReaddirSync(biblesPath);
      const tHelpsResources = cleanReaddirSync(tHelpsPath);

      bibleIds.forEach((bibleId) => {
        const bibleIdPath = path.join(biblesPath, bibleId);
        const owners = getLatestVersionsAndOwners(bibleIdPath) || {};
        for (const owner of Object.keys(owners)) {
          const bibleLatestVersion = owners[owner];
          if (bibleLatestVersion) {
            const pathToBibleManifestFile = path.join(bibleLatestVersion, 'manifest.json');
            const {version, owner} = getVersionAndOwnerFromPath(bibleLatestVersion);

            if (fs.existsSync(pathToBibleManifestFile)) {
              const resourceManifest = fs.readJsonSync(pathToBibleManifestFile);
              const remoteModifiedTime = (resourceManifest.remoteModifiedTime !== EMPTY_TIME) && resourceManifest.remoteModifiedTime;
              const localResource = {
                languageId,
                resourceId: bibleId,
                owner,
                version,
                modifiedTime: remoteModifiedTime || resourceManifest.catalog_modified_time,
                manifest: resourceManifest,
              };

              localResourceList.push(localResource);
            } else {
              console.warn(`getLocalResourceList(): no such file or directory, ${pathToBibleManifestFile}`);
            }
          } else {
            console.log(`getLocalResourceList(): bibleLatestVersion is ${bibleLatestVersion}.`);
          }
        }
      });

      tHelpsResources.forEach((tHelpsId) => {
        const tHelpResource = path.join(tHelpsPath, tHelpsId);
        const owners = getLatestVersionsAndOwners(tHelpResource) || {};
        for (const owner of Object.keys(owners)) {
          const tHelpsLatestVersion = owners[owner];

          if (tHelpsLatestVersion) {
            const pathTotHelpsManifestFile = path.join(tHelpsLatestVersion, 'manifest.json');
            const {version, owner} = getVersionAndOwnerFromPath(tHelpsLatestVersion);

            if (fs.existsSync(pathTotHelpsManifestFile)) {
              const resourceManifest = fs.readJsonSync(pathTotHelpsManifestFile);
              const localResource = {
                languageId,
                resourceId: tHelpsId,
                owner,
                version,
                modifiedTime: resourceManifest.catalog_modified_time,
                manifest: resourceManifest,
              };

              localResourceList.push(localResource);
            } else {
              console.warn(`getLocalResourceList(): no such file or directory, ${pathTotHelpsManifestFile}`);
            }
          } else {
            console.log(`getLocalResourceList(): tHelpsLatestVersion is ${tHelpsLatestVersion}.`);
          }
        }
      });
    }
    return localResourceList;
  } catch (error) {
    console.error(error);
    return null;
  }
};
