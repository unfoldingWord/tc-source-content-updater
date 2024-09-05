import fs from 'fs-extra';
import path from 'path-extra';
import rimraf from 'rimraf';
import * as Throttle from 'promise-parallel-throttle';
// helpers
import {
  appendError,
  encodeOwnerStr,
  formatError,
  getActualResourcePath,
  getErrorMessage,
  getSubdirOfUnzippedResource,
  makeTwGroupDataResource,
  processResource,
  removeAllButLatestVersion,
  unzipResource,
} from './resourcesHelpers';
import * as parseHelpers from './parseHelpers';
import * as downloadHelpers from './downloadHelpers';
import * as moveResourcesHelpers from './moveResourcesHelpers';
import {getOtherTnsOLVersions} from './translationHelps/tnArticleHelpers';
// constants
import * as errors from '../resources/errors';
import * as Bible from '../resources/bible';
import {
  DOOR43_CATALOG,
  OWNER_SEPARATOR,
  downloadManifestData,
  getReleaseMetaData,
  readJsonFile,
} from './apiHelpers';
import {areWeOnline} from './utils';
import {STAGE} from '../index';

/**
 * add download error keeping track of error message, download url, and if parse error type (if not parse error, then download error)
 * @param {Array} downloadErrors - list of download errors
 * @param {Boolean} parseError
 * @param {String} errorMessage
 * @param {String} downloadUrl
 */
export function addDownloadError(downloadErrors, parseError, errorMessage, downloadUrl) {
  downloadErrors.push({
    parseError,
    errorMessage,
    downloadUrl,
  });
}

/**
 * if not original language resource, removes all but latest.  If original language resource, only removes unused old original language resources
 * @param {string} resourcesPath - path to all resources
 * @param {string} currentResourcePath - path for current download resource version
 * @param {string} originalLanguageId
 * @param {string} version
 * @param {boolean} isGreekOrHebrew - true if original language resource
 * @param {string} owner
 */
export function removeUnusedResources(resourcesPath, currentResourcePath, originalLanguageId,
                                      version, isGreekOrHebrew, owner) {
  let versionsToNotDelete = [];
  const resourceVersionsPath = path.dirname(currentResourcePath); // get folder for all the versions
  // Get the version numbers of the original language used by other tNs so that needed versions are not deleted.
  if (isGreekOrHebrew) {
    versionsToNotDelete = getOtherTnsOLVersions(resourcesPath, originalLanguageId);
  }
  // Make sure that the resource currently being downloaded is not deleted
  versionsToNotDelete.push('v' + version);
  removeAllButLatestVersion(resourceVersionsPath, versionsToNotDelete, owner);
}

/**
 *
 * @param {object} resource
 * @return {string}
 */
export function getVersionFolder(resource) {
  let versionDir = 'v' + resource.version;
  if (resource.owner) {
    const ownerStr = encodeOwnerStr(resource.owner);
    versionDir += `${OWNER_SEPARATOR}${ownerStr}`;
  }
  return versionDir;
}

/**
 * save flag that resources contain pre-release data if stage is preprod
 * @param {String} resourcesPath
 * @param {String} stage
 */
export function setResourcesPreReleaseStateFromStage(resourcesPath, stage) {
  if (isStagePreRelease(stage)) {
    setResourcesContainPreReleaseData(resourcesPath, true);
  }
}

/**
 * get path for main manifest
 * @param {String} resourcesPath
 * @return {*}
 */
export function getMainManifestPath(resourcesPath) {
  const mainManifestPath = path.join(resourcesPath, 'source-content-updater-manifest.json');
  return mainManifestPath;
}

/**
 * save flag that resources contain pre-release data.  Flag is truthy
 * @param {String} resourcesPath
 * @param {boolean} flag
 */
export function setResourcesContainPreReleaseData(resourcesPath, flag) {
  const mainManifestPath = getMainManifestPath(resourcesPath);
  let manifest = readJsonFile(mainManifestPath);
  if (!manifest) {
    manifest = {};
  }
  manifest.havePreReleaseData = !!flag;
  try {
    fs.outputJsonSync(mainManifestPath, manifest);
  } catch (e) {
    console.error(`setResourcesContainPreReleaseData(): could not save ${mainManifestPath}`, e);
  }
}

/**
 * checks flag to see if we have pre-release data
 * @param {String} resourcesPath
 * @return {boolean} true if we have downloaded pre-release data
 */
export function doResourcesContainPreReleaseData(resourcesPath) {
  const mainManifestPath = getMainManifestPath(resourcesPath);
  const manifest = readJsonFile(mainManifestPath);
  if (manifest) {
    return manifest.havePreReleaseData;
  }
  return false;
}

/**
 * returns true is stage is pre-release
 * @param {string} stage
 * @return {boolean} true if pre-release
 */
export function isStagePreRelease(stage) {
  return stage === STAGE.PRE_PROD;
}

/**
 * checks flag to see if we have pre-release data
 * @param {object} config
 * @return {boolean} true if we are downloading pre-release data
 */
export function doingPreReleaseFetching(config = {}) {
  return isStagePreRelease(config.stage);
}

/**
 * check if we are doing pre-release checking or have prerelease downloads
 * @param {String} resourcesPath
 * @param {object} config
 * @return {boolean} true if we are doing pre-release data
 */
export function doingPreRelease(resourcesPath, config = {}) {
  const doingPrerelease = doingPreReleaseFetching(config) || doResourcesContainPreReleaseData(resourcesPath);
  return doingPrerelease;
}

/**
 * @description Downloads the resources that need to be updated for a given language using the DCS API
 * @param {Object.<{
 *             languageId: String,
 *             resourceId: String,
 *             localModifiedTime: String,
 *             remoteModifiedTime: String,
 *             downloadUrl: String,
 *             version: String,
 *             subject: String,
 *             catalogEntry: {langResource, bookResource, format}
 *           }>} resource - resource to download
 * @param {String} resourcesPath Path to the user resources directory
 * @param {Array} downloadErrors - parsed list of download errors with details such as if the download completed (vs. parsing error), error, and url
 * @param {object} config - configuration object
 * @return {Promise} Download promise
 */
export const downloadAndProcessResource = async (resource, resourcesPath, downloadErrors, config = {}) => {
  if (!resource) {
    throw Error(errors.RESOURCE_NOT_GIVEN);
  } else if (!resourcesPath) {
    throw Error(formatError(resource, errors.RESOURCES_PATH_NOT_GIVEN));
  }

  if (config.getCancelState && config.getCancelState()) {
    console.warn(`downloadAndProcessResource() download of ${resource.downloadUrl} cancelled`);
    return; // if user cancelled then skip
  }

  const doingPreRelease_ = doingPreRelease(resourcesPath, config);
  const resourceData = resource.catalogEntry ? resource.catalogEntry.resource : resource;
  if (!resource.version || (resource.version === 'master')) {
    if (!areWeOnline()) {
      const message = `Download ${resource.downloadUrl} error, disconnected from internet`;
      console.log(message);
      throw message;
    }
    const owner = resourceData.owner || resource.owner;
    const tag = resource.version || 'master';
    const repo = resourceData.name || `${resource.languageId}_${resource.resourceId}`;
    const latest = await getReleaseMetaData({owner, repo, tag, baseUrl: config.DCS_BASE_URL});
    const release = latest && latest.release;
    let version = release && release.tag_name;
    resource.downloadUrl = release && release.zipball_url || latest.zipball_url;
    if (!version) { // if no release found, then get version from manifest data
      const manifest = await downloadManifestData({owner, repo, tag, baseUrl: config.DCS_BASE_URL});
      version = manifest && manifest.dublin_core && manifest.dublin_core.version;
    }
    if (version) {
      resource.version = version;
    }
  }

  // Resource is the Greek UGNT or Hebrew UHB
  const isGreekOrHebrew = (resource.languageId === Bible.NT_ORIG_LANG && resource.resourceId === Bible.NT_ORIG_LANG_BIBLE) ||
    (resource.languageId === Bible.OT_ORIG_LANG && resource.resourceId === Bible.OT_ORIG_LANG_BIBLE);
  fs.ensureDirSync(resourcesPath);
  const importsPath = path.join(resourcesPath, 'imports');
  fs.ensureDirSync(importsPath);
  let importPath = null;
  let zipFilePath = null;
  let downloadComplete = false;
  try {
    try {
      const zipFileName = `${resource.languageId}_${resource.resourceId}_v${resource.version}_${encodeURIComponent(resource.owner)}.zip`;
      zipFilePath = path.join(importsPath, zipFileName);
      console.log('Downloading: ' + resource.downloadUrl);
      if (!areWeOnline()) {
        const message = `Download ${resource.downloadUrl} error, disconnected from internet`;
        console.log(message);
        throw message;
      }
      const results = await downloadHelpers.download(resource.downloadUrl, zipFilePath);
      if (results.status === 200) {
        downloadComplete = true;
      } else {
        const message = `Download ${resource.downloadUrl} error, status: ${results.status}`;
        console.log(message);
        throw message;
      }
    } catch (err) {
      throw Error(appendError(errors.UNABLE_TO_DOWNLOAD_RESOURCES, err));
    }
    try {
      if (config.getCancelState && config.getCancelState()) {
        console.warn(`downloadAndProcessResource() unzipping of ${resource.downloadUrl} cancelled`);
        return; // if user cancelled then skip
      }
      console.log('Unzipping: ' + resource.downloadUrl);
      importPath = await unzipResource(resource, zipFilePath, resourcesPath);
    } catch (err) {
      throw Error(appendError(errors.UNABLE_TO_UNZIP_RESOURCES, err));
    }
    if (config.getCancelState && config.getCancelState()) {
      console.warn(`downloadAndProcessResource() processing of ${resource.downloadUrl} cancelled`);
      return; // if user cancelled then skip
    }
    console.log('Processing: ' + resource.downloadUrl);
    const importSubdirPath = getSubdirOfUnzippedResource(importPath);
    const processedFilesPath = await processResource(resource, importSubdirPath, resourcesPath, downloadErrors, config);
    if (processedFilesPath) {
      const currentResourcePath = getActualResourcePath(resource, resourcesPath);
      try {
        await moveResourcesHelpers.moveResources(processedFilesPath, currentResourcePath);
      } catch (err) {
        throw Error(appendError(errors.UNABLE_TO_MOVE_RESOURCE_INTO_RESOURCES, err));
      }
      if (!doingPreRelease_) {
        removeUnusedResources(resourcesPath, currentResourcePath, resource.languageId, resource.version, isGreekOrHebrew);
      }
    } else {
      throw Error(errors.FAILED_TO_PROCESS_RESOURCE);
    }
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.error('Error getting ' + resource.downloadUrl + ': ' + errorMessage);
    addDownloadError(downloadErrors, downloadComplete, errorMessage, resource.downloadUrl);
    throw Error(formatError(resource, errorMessage));
  } finally {
    if (zipFilePath) {
      rimraf.sync(zipFilePath, fs);
    }
    if (importPath) {
      rimraf.sync(importPath, fs);
    }
  }
  console.log('Processed: ' + resource.downloadUrl);
  return resource;
};

/**
 * downloads and processes the resource catching and saving errors
 * @param {Object} resource being downloaded
 * @param {String} resourcesPath - path to save resources
 * @param {Array} errorList - keeps track of errors
 * @param {Array} downloadErrors - parsed list of download errors with details such as if the download completed (vs. parsing error), error, and url
 * @param {object} config - configuration object
 * @return {Promise} promise
 */
export const downloadAndProcessResourceWithCatch = async (resource, resourcesPath, errorList, downloadErrors, config = {}) => {
  let result = null;
  try {
    result = await downloadAndProcessResource(resource, resourcesPath, downloadErrors, config);
    console.log('Update Success: ' + resource.downloadUrl);
  } catch (e) {
    console.log('Update Error:');
    console.error(e);
    errorList.push(e);
  }
  return result;
};

/**
 * searches resources to find item with matching languageId and resourceId
 * @param {Array} resources
 * @param {String} languageId
 * @param {String} resourceId
 * @return {Object}
 */
export const findMatchingResource = (resources, languageId, resourceId) => {
  const found = resources.find(item =>
    ((item.languageId === languageId) && (item.resourceId === resourceId)));
  return found;
};

/**
 * orders resources - ta,tw,tn then other resources
 * @param {object} resource
 * @return {number}
 */
function helpsOrder(resource) {
  if (resource && resource.resourceId) {
    if (resource.resourceId) {
      switch (resource.resourceId.toLowerCase()) {
        case 'ta':
          return 0;
        case 'tw':
          return 1;
        case 'tn':
          return 2;
        default:
          return 100;
      }
    }
  }
  return 100000;
}

/**
 * move helps resources to first in list - ta,tw,tn then other resources
 * @param {object} a
 * @param {object} b
 * @return {number}
 */
function sortHelps(a, b) {
  const order = helpsOrder(a) > helpsOrder(b) ? 1 : -1;
  return order;
}

/**
 * log the online status
 */
export function showOnlineStatus() {
  if (!global.navigator) {
    console.log('showOnlineStatus - navigator is not defined, so we will try anyway since we may be running as a script');
  } else {
    const online = areWeOnline();
    console.log(`showOnlineStatus - navigator is defined, and online status is ${online}`);
  }
}

/**
 * @description Downloads the resources that need to be updated for the given languages using the DCS API
 * @param {Array} languageList - Array of languages to download the resources for
 * @param {String} resourcesPath - Path to the resources directory where each resource will be placed
 * @param {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {langResource, bookResource, format}
 *                 }>} resources - resources that will be downloaded if the lanugage IDs match
 * @param {Array} downloadErrors - parsed list of download errors with details such as if the download completed (vs. parsing error), error, and url
 * @param {Boolean} allAlignedBibles - if true all aligned Bibles from all languages are updated also
 * @param {object} config - configuration object
 * @return {Promise} Promise that returns a list of all the resources updated, rejects if
 * any fail
 */
export const downloadResources = (languageList, resourcesPath, resources, downloadErrors, allAlignedBibles = false, config = {}) => {
  return new Promise((resolve, reject) => {
    if (!allAlignedBibles && (!languageList || !languageList.length)) {
      reject(errors.LANGUAGE_LIST_EMPTY);
      return;
    }

    if (!resourcesPath) {
      reject(errors.RESOURCES_PATH_NOT_GIVEN);
      return;
    }

    showOnlineStatus();
    fs.ensureDirSync(resourcesPath);
    const importsDir = path.join(resourcesPath, 'imports');
    let downloadableResources = [];
    languageList.forEach((languageId) => {
      let resourcesForLanguage = parseHelpers.getResourcesForLanguage(resources, languageId);
      resourcesForLanguage = resourcesForLanguage.sort(sortHelps); // fetch helps first
      resourcesForLanguage.forEach(resource => {
        const loadAfter = resource.catalogEntry && resource.catalogEntry.resource && resource.catalogEntry.resource.loadAfter;
        if (loadAfter) {
          loadAfter.forEach(afterResource => {
            resourcesForLanguage.push(afterResource);
          });
        }
      });
      downloadableResources = downloadableResources.concat(resourcesForLanguage);
    });

    if (allAlignedBibles) {
      console.log('downloadResources() - updating all aligned bibles');
      resources.forEach((resource) => {
        if (resource.subject === 'Aligned_Bible') {
          const duplicate = findMatchingResource(downloadableResources, resource.languageId, resource.resourceId);
          if (!duplicate) {
            downloadableResources.push(resource);
          }
        }
      });
    }

    if (!downloadableResources || !downloadableResources.length) {
      resolve([]);
      return;
    }

    const errorList = [];
    downloadableResources = sortDownloableResources(downloadableResources.filter((resource) => resource));

    const queue = downloadableResources.map((resource) =>
      () => downloadAndProcessResourceWithCatch(resource, resourcesPath, errorList, downloadErrors, config));
    Throttle.all(queue, {maxInProgress: 2})
      .then((result) => {
        rimraf.sync(importsDir, fs);
        if (!errorList.length) {
          resolve(result);
        } else {
          const errorMessages = errorList.map((e) => (e.message || e));
          const returnErrorMessage = errorMessages.join('\n');
          reject(new Error(returnErrorMessage));
        }
      },
      (err) => {
        rimraf.sync(importsDir, fs);
        reject(err);
      });
  });
};

/**
 * find order for resourceId
 * @param {Array.<string>} resourcePrecedence
 * @param {string} resourceId
 * @return {*}
 */
function getResourcePrecidence(resourcePrecedence, resourceId) {
  let index = resourcePrecedence.indexOf(resourceId);
  if (index < 0) {
    index = 1000000;
  }
  return index;
}

/**
 * Return book code with highest precedence to sort method
 * @param {*} a - First book code of 2
 * @param {*} b - second book code
 * @return {Number}
 */
export function resourceSort(a, b) {
  const resourcePrecedence = ['ta', 'ult', 'glt', 'tw', 'twl', 'tn']; // we should download these resources in this order, others will just be alphabetical

  const indexA = getResourcePrecidence(resourcePrecedence, a);
  const indexB = getResourcePrecidence(resourcePrecedence, b);
  let diff = 0;
  if (indexA === indexB) { // same resource types or both not in list
    diff = a < b ? -1 : a > b ? 1 : 0;
  } else {
    diff = indexA - indexB; // this plays off the fact other resources will be high index value
  }
  return diff;
}

/**
 * Sorts the list of downloadable resources. Sorts by language, then owner and moves tA
 * to the front of the array in order to be downloaded before tN
 * since tN will use tA articles to generate the groupsIndex files.
 * @param {array} downloadableResources list of downloadable resources.
 * @return {array} sorted list of downloadable resources.
 */
export const sortDownloableResources = (downloadableResources) => {
  return downloadableResources.sort((resourceA, resourceB) => {
    const langA = resourceA.languageId;
    const langB = resourceB.languageId;
    if (langB > langA) {
      return -1;
    } else if (langB === langA) {
      const ownerA = resourceA.owner;
      const ownerB = resourceB.owner;
      if (ownerB > ownerA) {
        return -1;
      } else if (ownerB === ownerA) {
        const idA = resourceA.resourceId.toLowerCase();
        const idB = resourceB.resourceId.toLowerCase();
        const compareResult = resourceSort(idA, idB);
        // console.log(compareResult);
        return compareResult;
      } else { // ownerB < ownerA
        return 1;
      }
    } else { // langB < langA
      return 1;
    }
  });
};
