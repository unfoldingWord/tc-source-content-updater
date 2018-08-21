import fs from 'fs-extra';
import path from 'path-extra';
// helpers
import * as resourcesHelpers from './resourcesHelpers';
import * as parseHelpers from './parseHelpers';
import * as downloadHelpers from './downloadHelpers';
import * as moveResourcesHelpers from './moveResourcesHelpers';

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
 * @return {Promise} Promise that resolves to success if all resources downloaded and processed, rejects if
 * any fail
 */
export const downloadResources = (languageList, resourcesPath, resources) => {
  return new Promise((resolve, reject) => {
    if (!languageList || !languageList.length) {
      reject('Language list is empty');
      return;
    }
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
      const promise = new Promise((resolve, reject) => {
        let zipFilePath = null;
        let importPath = null;
        let processedFilesPath = null;
        let twGroupDataPath = null;
        downloadResource(resource, resourcesPath)
        .then(async result => {
          zipFilePath = result.dest;
          importPath = resourcesHelpers.unzipResource(resource, zipFilePath, resourcesPath);
          let importSubdirPath = importPath;
          const importSubdirs = fs.readdirSync(importPath);
          console.log(importPath, importSubdirs);
          if (importSubdirs.length === 1 && fs.lstatSync(path.join(importPath, importSubdirs[0])).isDirectory()) {
            importSubdirPath = path.join(importPath, importSubdirs[0]);
          }
          processedFilesPath = resourcesHelpers.processResource(resource, importSubdirPath);
          if (processedFilesPath) {
            const resourcePath = resourcesHelpers.getActualResourcePath(resource, resourcesPath);
            moveResourcesHelpers.moveResources(importSubdirPath, resourcePath);
            resource.resourcePath = resourcePath;
            // Extra step if the resource is the Greek UGNT or Hebrew UHB 
            if ((resource.languageId === 'grc' && resource.resourceId === 'ugnt') ||
                (resource.languageId === 'hbo' && resource.resourceId === 'uhb')) {
              twGroupDataPath = resourcesHelpers.makeTwGroupDataResource(resource, processedFilesPath);
              const twGroupDataResourcesPath = path.join(resourcesPath, resource.languageId, 'translationHelps', 'translationWords');
              moveResourcesHelpers.moveResources(twGroupDataPath, twGroupDataResourcesPath);
            }
          } else {
            reject('Failed to process resource "' + resource.resourceId + '" for language "' + resource.languageId + '"');
            return;
          }
          resolve(resource.resourceId);
        })
        .catch(reject)
        .finally(() => {
          // fs.unlink(zipFilePath);
          // fs.remove(importPath);
          // if (processedFilesPath)
          //   fs.remove(processedFilesPath);
          // if (twGroupDataPath)
          //   fs.remove(twGroupDataPath);
        });
      });
      promises.push(promise);
    });
    Promise.all(promises).then(resolve, reject);
  });
};

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
export function downloadResource(resource, resourcesPath) {
  const importsPath = path.join(resourcesPath, 'imports');
  fs.ensureDirSync(importsPath);
  const zipFileName = resource.languageId + '_' + resource.resourceId + '_v' + resource.version + '.zip';
  const zipFilePath = path.join(importsPath, zipFileName);
  return downloadHelpers.download(resource.downloadUrl, zipFilePath);
}
