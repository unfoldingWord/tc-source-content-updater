import fs from 'fs-extra';
import path from 'path-extra';
import rimraf from 'rimraf';
// helpers
import * as resourcesHelpers from './resourcesHelpers';
import * as parseHelpers from './parseHelpers';
import * as downloadHelpers from './downloadHelpers';
import * as moveResourcesHelpers from './moveResourcesHelpers';
// constants
import * as errors from '../resources/errors';

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
 * @param {String} resourcesPath Path to the resources directory
 * @param {Function} callback Callback when downloaded
 * @param {Function} errCallback Callback for errors
 * @return {Promise} Download promise
 */
export const downloadResource = async (resource, resourcesPath) => {
  if (!resource)
    throw Error(errors.RESOURCE_NOT_GIVEN);
  if (!resourcesPath)
    throw Error(resourcesHelpers.formatError(resource, errors.RESOURCES_PATH_NOT_GIVEN));
  fs.ensureDirSync(resourcesPath);
  const importsPath = path.join(resourcesPath, 'imports');
  fs.ensureDirSync(importsPath);
  let importPath = null;
  try {
    const zipFileName = resource.languageId + '_' + resource.resourceId + '_v' + resource.version + '.zip';
    const zipFilePath = path.join(importsPath, zipFileName);
    await downloadHelpers.download(resource.downloadUrl, zipFilePath);
    importPath = await resourcesHelpers.unzipResource(resource, zipFilePath, resourcesPath);
  } catch (err) {
    throw Error(resourcesHelpers.formatError(resource, errors.UNABLE_TO_DOWNLOAD_AND_UNZIP_RESOURCES + ' ' + err.message));
  }
  const importSubdirPath = resourcesHelpers.getSubdirOfUnzippedResource(importPath);
  const processedFilesPath = resourcesHelpers.processResource(resource, importSubdirPath);
  if (processedFilesPath) {
    // Extra step if the resource is the Greek UGNT or Hebrew UHB
    if ((resource.languageId === 'grc' && resource.resourceId === 'ugnt') ||
      (resource.languageId === 'hbo' && resource.resourceId === 'uhb')) {
      const twGroupDataPath = resourcesHelpers.makeTwGroupDataResource(resource, processedFilesPath);
      const twGroupDataResourcesPath = path.join(resourcesPath, resource.languageId, 'translationHelps', 'translationWords', 'v' + resource.version);
      try {
        await moveResourcesHelpers.moveResources(twGroupDataPath, twGroupDataResourcesPath);
      } catch (err) {
        throw Error(resourcesHelpers.formatError(resource, errors.UNABLE_TO_CREATE_TW_GROUP_DATA));
      }
    }
    const resourcePath = resourcesHelpers.getActualResourcePath(resource, resourcesPath);
    try {
      await moveResourcesHelpers.moveResources(processedFilesPath, resourcePath);
    } catch (err) {
      throw Error(resourcesHelpers.formatError(resource, errors.UNABLE_TO_MOVE_RESOURCE_INTO_RESOURCES));
    }
    resourcesHelpers.removeAllButLatestVersion(path.dirname(resourcePath));
  } else {
    throw Error(resourcesHelpers.formatError(resource, errors.FAILED_TO_PROCESS_RESOURCE));
  }
  rimraf.sync(zipFilePath, fs);
  rimraf.sync(importPath, fs);
  return resource;
};

/**
 * download the resource catching and saving errors
 * @param {Object} resource being downloaded
 * @param {String} resourcesPath - path to save resources
 * @param {Array} errorList - keeps track of errors
 * @return {Promise} promise
 */
export const downloadResourceAndCatchErrors = async (resource, resourcesPath, errorList) => {
  let result = null;
  try {
    result = await downloadResource(resource, resourcesPath);
    console.log("Download Success: " + resource.downloadUrl);
  } catch (e) {
    console.log("Download Error:");
    console.log(e);
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
 * @return {Promise} Promise that returns a list of all the resources updated, rejects if
 * any fail
 */
export const downloadResources = (languageList, resourcesPath, resources) => {
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
    languageList.forEach(languageId => {
      downloadableResources = downloadableResources.concat(parseHelpers.getResourcesForLanguage(resources, languageId));
    });

    if (!downloadableResources || !downloadableResources.length) {
      resolve([]);
      return;
    }

    const promises = [];
    const errorList = [];
    downloadableResources.forEach(resource => {
      if (!resource)
        return;
      promises.push(downloadResourceAndCatchErrors(resource, resourcesPath, errorList));
    });
    Promise.all(promises)
      .then(result => {
        rimraf.sync(importsDir, fs);
        if (!errorList.length) {
          resolve(result);
        } else {
          const errorMessages = errorList.map(e => (e.message || e));
          const returnErrorMessage = errorMessages.join('\n');
          reject(new Error(returnErrorMessage));
        }
      },
      err => {
        rimraf.sync(importsDir, fs);
        reject(err);
      });
  });
};
