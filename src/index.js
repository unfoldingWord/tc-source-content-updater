import path from 'path';
import ospath from 'ospath';
// helpers
import * as apiHelpers from './helpers/apiHelpers';
import * as parseHelpers from './helpers/parseHelpers';
import * as moveResourcesHelpers from './helpers/moveResourcesHelpers';
import * as packageParseHelpers from "./helpers/packageParseHelpers";
import * as taArticleHelpers from "./helpers/translationHelps/taArticleHelpers";
import * as twArticleHelpers from "./helpers/translationHelps/twArticleHelpers";
import * as twGroupDataHelpers from "./helpers/translationHelps/twGroupDataHelpers";

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
 * Used to initiate a load of the latests resource so that the user can then select which ones
 * they would like to update.
 * Note: This function only returns the resources that already up to date on the user machine
 * @param {boolean} update - indicates whether the latest catalog should be updated
 * before the request
 * @param {Array} resourceList - list of resources that are on the users local machine already
 * @return {Array} - Array of resources and their corresponding time stamps
 */
Updater.prototype.getLatestsResourceDates = async function(update = false,
  resourceList) {
  if (update || !this.catalog) {
    // Can force update before request or will automatically if
    // the resources are not already populated
    await this.updateCatalog();
  }
  return parseHelpers.getLatestsResourceDates(this.catalog, resourceList);
};

/**
 * Downloads the resorces from the specified list using the DCS API
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
 * @description Parses the bible package to generate json bible contents, manifest, and index
 * @param {String} packagePath - path to downloaded (unzipped) package
 * @param {String} resultsPath - path to store processed bible
 * @return {Boolean} true if success
 */
Updater.prototype.parseBiblePackage = function(packagePath, resultsPath) {
  return packageParseHelpers.parseBiblePackage(packagePath, resultsPath);
};

/**
 * @description Processes the extracted files for translationAcademy to create a single file for each
 * article
 * @param {String} extractedFilesPath - Path to the extracted files that came from the zip file in the catalog
 * @param {String} outputPath - Path to place the processed files WITHOUT version in the path
 * @return {String} The path to the processed translationAcademy files with version
 */
Updater.prototype.processTranslationAcademy = function(extractedFilesPath, outputPath) {
  return taArticleHelpers.processTranslationAcademy(extractedFilesPath, outputPath);
};

/**
 * @description Processes the extracted files for translationWord to cerate the folder
 * structure and produce the index.js file for the language with the title of each article.
 * @param {String} extractedFilesPath - Path to the extracted files that came from the zip file from the catalog
 * @param {String} outputPath - Path to place the processed resource files WIHTOUT the version in the path
 * @return {String} Path to the processed translationWords files with version
 */
Updater.prototype.processTranslationWords = function(extractedFilesPath, outputPath) {
  return twArticleHelpers.processTranslationWords(extractedFilesPath, outputPath);
};

/**
 * @description Generates the tW Group Data files from the given aligned Bible
 * @param {string} biblePath Path to the Bible with aligned data
 * @param {string} outputPath Path where the translationWords group data is to be placed WITHOUT version
 * @return {string} Path where tW was generated with version
 */
Updater.prototype.generateTwGroupDataFromAlignedBible = function(biblePath, outputPath) {
  return twGroupDataHelpers.generateTwGroupDataFromAlignedBible(biblePath, outputPath);
};

export default Updater;
