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
  this.remoteCatalog = null;
  this.updatedCatalogResources = null;
}

Updater.prototype = {};

/**
 * Method to manually fetch the latest remoteCatalog for the current
 * Updater instance. This function has no return value
 */
Updater.prototype.updateCatalog = async function() {
  this.remoteCatalog = await apiHelpers.getCatalog();
};

/**
 * Used to initiate a load of the latest resource so that the user can then select which ones
 * they would like to update.
 * Note: This function only returns the resources that are not up to date on the user machine
 * before the request
 * @param {Array.<{
 *                  languageId: String,
 *                  resourceId: String,
 *                  modifiedTime: String,
 *                  }>} localResourceList - list of resources that are on the users local machine already {}
 * @return {
 *          Array.<{
 *                   languageId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String
 *                 }>
 *         }} - list of languages that have updates in catalog
 */
Updater.prototype.getLatestResources = async function(localResourceList) {
  await this.updateCatalog();
  this.updatedCatalogResources =
      parseHelpers.getLatestResources(this.remoteCatalog, localResourceList);
  return parseHelpers.getUpdatedLanguageList(this.updatedCatalogResources);
};

/**
 * get all resources to update for language
 * @param {String} languageId - language to search for
 * @return {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {langResource, bookResource, format}
 *                 }>} - all updated resources for language
 */
export function getResourcesForLanguage(languageId) {
  return parseHelpers.getResourcesForLanguage(this.updatedCatalogResources,
    languageId);
}

/**
 * Downloads the resources from the specified list using the DCS API
 *
 * @param {Array.<String>} languageList - Array of language codes to retrieve from the API
 */
Updater.prototype.downloadResources = async function(languageList) {
  // call this.getResourcesForLanguage(lang) for each language in list to get all resources to update
  // download each resource
    // parse
    // move
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
