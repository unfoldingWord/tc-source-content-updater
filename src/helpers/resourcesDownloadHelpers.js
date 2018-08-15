import async from 'async';
import fs from 'fs-extra';
import path from 'path-extra';
import tmp from 'tmp';
// helpers
import * as resourcesHelpers from './resourcesHelpers';
import * as parseHelpers from './parseHelpers';
import * as downloadHelpers from './downloadHelpers';

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
export function downloadResources(languageList, resourcesPath, resources) {
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

    let resourcesDownloaded = [];
    console.log(downloadableResources);
    async.eachOfLimit(downloadableResources, 10, async (resource, key, errCallback) => {
      if (!resource) {
        return;
      }
      let zipPath = null;
      let importPath = null;
      console.log("trying", resource.languageId, resource.resourceId);
      await downloadResource(resource, resourcesPath).then(async result => {
        zipPath = result.dest;
        importPath = resourcesHelpers.unzipResource(resource, zipPath, resourcesPath);
        const processResult = resourcesHelpers.processResource(resource, importPath);
        if (processResult) {
          const resourcePath = resourcesHelpers.getActualResourcePath(resource, resourcesPath);
          resourcesHelpers.moveResource(importPath, resourcePath, false);
          resource.resourcePath = resourcePath;
          resourcesDownloaded.push(resource);
        } else {
          errCallback('Failed to process resource "' + resource.resourceId + '" for language "' + resource.languageId + '"');
        }
        console.log("DONE WITH " + resource.resourceId);
      })
      .catch(errCallback)
      .finally(() => {
        // fs.unlink(zipPath);
        // fs.remove(importPath);
      });
    }, err => {
      console.log("END", err);
      if (err) {
        reject(err);
      } else {
        resolve(resourcesDownloaded);
      }
    });
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
 * @param {String} resourcesPath Path to the resources directory
 * @param {Function} callback Callback when downloaded
 * @param {Function} errCallback Callback for errors
 * @return {Promise} Download promise
 */
export function downloadResource(resource, resourcesPath) {
  const importsPath = path.join(resourcesPath, 'imports');
  fs.mkdirpSync(importsPath);
  const zipPath = tmp.fileSync({
    dir: importsPath,
    prefix: resource.languageId + '_' + resource.resourceId + '_',
    postfix: '.zip',
    keep: true
  }).name;
  return downloadHelpers.download(resource.downloadUrl, zipPath);
}
