import fs from 'fs-extra';
import path from 'path-extra';
import rimraf from 'rimraf';
import * as Throttle from 'promise-parallel-throttle';
// helpers
import {
  appendError,
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
 * @return {Promise} Download promise
 */
export const downloadAndProcessResource = async (resource, resourcesPath, downloadErrors) => {
  if (!resource) {
    throw Error(errors.RESOURCE_NOT_GIVEN);
  } else if (!resourcesPath) {
    throw Error(formatError(resource, errors.RESOURCES_PATH_NOT_GIVEN));
  }
  // Resource is the Greek UGNT or Hebrew UHB
  const isGreekOrHebrew = (resource.languageId === Bible.NT_ORIG_LANG && resource.resourceId === Bible.NT_ORIG_LANG_BIBLE) ||
    (resource.languageId === Bible.OT_ORIG_LANG && resource.resourceId === Bible.OT_ORIG_LANG_BIBLE);
  fs.ensureDirSync(resourcesPath);
  const importsPath = path.join(resourcesPath, 'imports');
  if (fs.existsSync(importPath)) { // do safe import folder delete
    const tempPath = importPath + '.temp';
    fs.moveSync(importPath, tempPath);
    fs.removeSync(tempPath);
  }
  fs.ensureDirSync(importsPath);
  let importPath = null;
  let zipFilePath = null;
  let downloadComplete = false;
  try {
    try {
      const zipFileName = resource.languageId + '_' + resource.resourceId + '_v' + resource.version + '.zip';
      zipFilePath = path.join(importsPath, zipFileName);
      console.log('Downloading: ' + resource.downloadUrl);
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
      console.log('Unzipping: ' + resource.downloadUrl);
      importPath = await unzipResource(resource, zipFilePath, resourcesPath);
    } catch (err) {
      throw Error(appendError(errors.UNABLE_TO_UNZIP_RESOURCES, err));
    }
    console.log('Processing: ' + resource.downloadUrl);
    const importSubdirPath = getSubdirOfUnzippedResource(importPath);
    const processedFilesPath = await processResource(resource, importSubdirPath, resourcesPath, downloadErrors);
    if (processedFilesPath) {
      // Extra step if the resource is the Greek UGNT or Hebrew UHB
      if (isGreekOrHebrew) {
        const twGroupDataPath = makeTwGroupDataResource(resource, processedFilesPath);
        const twGroupDataResourcesPath = path.join(resourcesPath, resource.languageId, 'translationHelps', 'translationWords', 'v' + resource.version);
        try {
          await moveResourcesHelpers.moveResources(twGroupDataPath, twGroupDataResourcesPath);
          removeAllButLatestVersion(path.dirname(twGroupDataResourcesPath));
        } catch (err) {
          throw Error(appendError(errors.UNABLE_TO_CREATE_TW_GROUP_DATA, err));
        }
      }
      const resourcePath = getActualResourcePath(resource, resourcesPath);
      try {
        await moveResourcesHelpers.moveResources(processedFilesPath, resourcePath);
      } catch (err) {
        throw Error(appendError(errors.UNABLE_TO_MOVE_RESOURCE_INTO_RESOURCES, err));
      }
      let versionsToNotDelete = [];
      // Get the version numbers of the orginal language used by other tNs so that needed versions are not deleted.
      if (isGreekOrHebrew) versionsToNotDelete = getOtherTnsOLVersions(resource.languageId);
      // Make sure that the resource currently being downloaded is not deleted
      versionsToNotDelete.push('v' + resource.version);
      removeAllButLatestVersion(path.dirname(resourcePath), versionsToNotDelete);
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
 * @return {Promise} promise
 */
export const downloadAndProcessResourceWithCatch = async (resource, resourcesPath, errorList, downloadErrors) => {
  let result = null;
  try {
    result = await downloadAndProcessResource(resource, resourcesPath, downloadErrors);
    console.log('Update Success: ' + resource.downloadUrl);
  } catch (e) {
    console.log('Update Error:');
    console.error(e);
    errorList.push(e);
  }
  return result;
};

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
 * @return {Promise} Promise that returns a list of all the resources updated, rejects if
 * any fail
 */
export const downloadResources = (languageList, resourcesPath, resources, downloadErrors) => {
  return new Promise((resolve, reject) => {
    if (!languageList || !languageList.length) {
      reject(errors.LANGUAGE_LIST_EMPTY);
      return;
    }
    if (!resourcesPath) {
      reject(errors.RESOURCES_PATH_NOT_GIVEN);
      return;
    }
    fs.ensureDirSync(resourcesPath);
    const importsDir = path.join(resourcesPath, 'imports');
    let downloadableResources = [];
    languageList.forEach((languageId) => {
      downloadableResources = downloadableResources.concat(parseHelpers.getResourcesForLanguage(resources, languageId));
    });

    if (!downloadableResources || !downloadableResources.length) {
      resolve([]);
      return;
    }

    const errorList = [];
    downloadableResources = sortDownloableResources(downloadableResources.filter((resource) => resource));

    const queue = downloadableResources.map((resource) =>
      () => downloadAndProcessResourceWithCatch(resource, resourcesPath, errorList, downloadErrors));
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
 * Sorts the list of downloadable resources. Specifically moves tA
 * to the front of the array in order to be downloaded before tN
 * since tN will use tA articles to generate the groupsIndex files.
 * @param {array} downloadableResources list of downloadable resources.
 * @return {array} sorted list of downloadable resources.
 */
const sortDownloableResources = (downloadableResources) => {
  return downloadableResources.sort((resourceA, resourceB) => {
    const firstResource = 'ta';// move ta to the front of the array so that it is downloaded before tn.
    const idA = resourceA.resourceId.toLowerCase();
    const idB = resourceB.resourceId.toLowerCase();

    return idA == firstResource ? -1 : idB == firstResource ? 1 : 0;
  });
};
