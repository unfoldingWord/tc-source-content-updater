import path from 'path';
import ospath from 'ospath';
// helpers
import * as apiHelpers from './helpers/apiHelpers';
import * as parseHelpers from './helpers/parseHelpers';
import * as moveResourcesHelpers from './helpers/moveResourcesHelpers';
import * as packageParseHelpers from "./helpers/packageParseHelpers";

/**
 * Updater constructor
 */
function Updater() {
  this.catalog = null;
}

Updater.prototype = {};

/**
 * Method to manually fetch the latest catalog for the current
 * Updater instance. This function has no return value
 */
Updater.prototype.updateCatalog = async function() {
  this.catalog = await apiHelpers.getCatalog();
};

/**
 * Used to initiate a load of the latest resource so that the user can then select which ones
 * they would like to update.
 * Note: This function only returns the resources that are not up to date on the user machine
 * @param {boolean} update - indicates whether the latest catalog should be updated
 * before the request
 * @param {Array.<{
 *                  lang_code: String,
 *                  bible_id: String,
 *                  modified_time: String
 *                  }>} resourceList - list of resources that are on the users local machine already {}
 * @return {{
 *          languages: Array.<String>,
 *          resources: Array.<{
 *                   lang_code: String,
 *                   bible_id: String,
 *                   local_modified_time: String,
 *                   remote_modified_time: String,
 *                   download_url: String,
 *                   version: String,
 *                   subject: String,
 *                   catalog_entry: {lang_resource, book_resource, format}
 *                 }>
 *         }} - updated resources
 */
Updater.prototype.getLatestResources = async function(update = false,
                                                      resourceList) {
  if (update || !this.catalog) {
    // Can force update before request or will automatically if
    // the resources are not already populated
    await this.updateCatalog();
  }
  return parseHelpers.getLatestResources(this.catalog, resourceList);
};

/**
 * Downloads the resources from the specified list using the DCS API
 *
 * @param {Array} resourceList - Array of resources to retrieve from the API
 */
Updater.prototype.downloadResources = async function(resourceList) {
};

/**
 * @description move the converted resource to user's resource folder
 * @param {String} resourceSourcePath - Location of selected downloaded resources
 * @param {String} languageCode - language of resource like en or hi
 */
Updater.prototype.moveResources = async function(
    resourceSourcePath, languageCode) {
  const resourceTargetPath = path.join(
      ospath.home(), 'translationCore', 'resources', languageCode);
  await moveResourcesHelpers.move(resourceSourcePath, resourceTargetPath);
  return;
};

/**
 * Parse the bible package to generate json bible contents, manifest, and index
 * @param {String} packagePath - path to downloaded (unzipped) package
 * @param {String} resultsPath - path to store processed bible
 * @return {Boolean} true if success
 */
Updater.prototype.parseBiblePackage = function(packagePath, resultsPath) {
  return packageParseHelpers.parseBiblePackage(packagePath, resultsPath);
};

export default Updater;
