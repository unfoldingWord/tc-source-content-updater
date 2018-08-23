import fs from 'fs-extra';
import path from 'path-extra';
import rimraf from 'rimraf';
// helpers
import * as resourcesHelpers from './resourcesHelpers';
import * as parseHelpers from './parseHelpers';
import * as downloadHelpers from './downloadHelpers';
import * as moveResourcesHelpers from './moveResourcesHelpers';

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
    throw Error('No resource given');
  if (!resourcesPath)
    throw Error('No path to the resources directory given');
  fs.ensureDirSync(resourcesPath);
  const importsPath = path.join(resourcesPath, 'imports');
  fs.ensureDirSync(importsPath);
  const zipFileName = resource.languageId + '_' + resource.resourceId + '_v' + resource.version + '.zip';
  const zipFilePath = path.join(importsPath, zipFileName);
  await downloadHelpers.download(resource.downloadUrl, zipFilePath);
  const importPath = await resourcesHelpers.unzipResource(resource, zipFilePath, resourcesPath);
  const importSubdirPath = resourcesHelpers.getSubdirOfUnzippedResource(importPath);
  const processedFilesPath = resourcesHelpers.processResource(resource, importSubdirPath);
  if (processedFilesPath) {
    // Extra step if the resource is the Greek UGNT or Hebrew UHB
    if ((resource.languageId === 'grc' && resource.resourceId === 'ugnt') ||
      (resource.languageId === 'hbo' && resource.resourceId === 'uhb')) {
      const twGroupDataPath = resourcesHelpers.makeTwGroupDataResource(resource, processedFilesPath);
      const twGroupDataResourcesPath = path.join(resourcesPath, resource.languageId, 'translationHelps', 'translationWords');
      const moveSuccess = moveResourcesHelpers.moveResources(twGroupDataPath, twGroupDataResourcesPath);
      if (!moveSuccess) {
        throw Error('Unable to create tW Group Data from ' + resource.resourceId + ' Bible');
      }
    }
    const resourcePath = resourcesHelpers.getActualResourcePath(resource, resourcesPath);
    const moveSuccess = moveResourcesHelpers.moveResources(processedFilesPath, resourcePath);
    if (!moveSuccess) {
      throw Error('Unable to copy resource into the resources directory');
    }
    resourcesHelpers.removeAllButLatestVersion(path.dirname(resourcePath));
  } else {
    throw Error('Failed to process resource "' + resource.resourceId + '" for language "' + resource.languageId + '"');
  }
  rimraf.sync(zipFilePath, fs);
  rimraf.sync(importPath, fs);
  return resource;
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
      reject('Language list is empty');
      return;
    }
    if (!resourcesPath) {
      reject('No path to the resources directory given');
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
    downloadableResources.forEach(resource => {
      if (!resource)
        return;
      promises.push(downloadResource(resource, resourcesPath));
    });
    Promise.all(promises)
      .then(resolve, reject)
      .finally(() => {
        rimraf.sync(importsDir, fs);
      });
  });
};
