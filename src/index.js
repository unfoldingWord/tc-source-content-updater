/* eslint-disable curly, no-invalid-this */
import path from 'path';
import ospath from 'ospath';
import fs from 'fs-extra';
// helpers
import * as apiHelpers from './helpers/apiHelpers';
import * as parseHelpers from './helpers/parseHelpers';
import * as moveResourcesHelpers from './helpers/moveResourcesHelpers';
import * as packageParseHelpers from './helpers/packageParseHelpers';
import * as taArticleHelpers from './helpers/translationHelps/taArticleHelpers';
import * as twArticleHelpers from './helpers/translationHelps/twArticleHelpers';
import * as twGroupDataHelpers from './helpers/translationHelps/twGroupDataHelpers';
import * as tnArticleHelpers from './helpers/translationHelps/tnArticleHelpers';
import * as resourcesDownloadHelpers from './helpers/resourcesDownloadHelpers';
import * as resourcesHelpers from './helpers/resourcesHelpers';
export {getOtherTnsOLVersions} from './helpers/translationHelps/tnArticleHelpers';
export {apiHelpers, parseHelpers, resourcesHelpers, resourcesDownloadHelpers};

// ============================
// defines useful for searching

export const STAGE = {
  PROD: 'prod',
  PRE_PROD: 'preprod',
  DRAFT: 'draft',
  LATEST: 'latest',
};

export const SUBJECT = {
  ALL_RESOURCES: null,
  ALL_TC_RESOURCES: 'Bible,Aligned Bible,Greek New Testament,Hebrew Old Testament,Translation Words,TSV Translation Words Links,TSV Translation Notes,Translation Academy',
  ALL_BIBLES: 'Bible,Aligned Bible,Greek New Testament,Hebrew Old Testament',
  ORIGINAL_LANGUAGE_BIBLES: 'Greek New Testament,Hebrew Old Testament',
  ALIGNED_BIBLES: 'Aligned Bible',
  UNALIGNED_BIBLES: 'Bible',
  ALL_TC_HELPS: 'Translation Words,TSV Translation Notes,Translation Academy',
  TRANSLATION_WORDS: 'Translation Words,TSV Translation Words Links',
  TRANSLATION_NOTES: 'TSV Translation Notes',
  TRANSLATION_ACADEMY: 'Translation Academy',
};

export const SORT = {
  SUBJECT: 'subject',
  REPO_NAME: 'reponame',
  TAG: 'tag',
  RELEASED_TIME: 'released',
  LANGUAGE_ID: 'lang',
  TITLE: 'title',
  DEFAULT: '', // by "lang", then "subject" and then "tag"
};

/**
 * Updater constructor
 */
function Updater() {
  this.remoteCatalog = null;
  this.updatedCatalogResources = null;
  this.downloadErrors = [];
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
Updater.prototype.searchCatalogNext = async function(searchParams, retries=3) {
  return await apiHelpers.searchCatalogNext(searchParams, retries);
};

/**
 * Method to manually fetch the detailed error list for recent download
 * @return {Array|null} any download/parse errors from last download attempt
 */
Updater.prototype.getLatestDownloadErrors = function() {
  return this.downloadErrors;
};

/**
 * Method to manually fetch the detailed error list for recent download and return as string
 * @return {String} any download/parse errors from last download attempt
 */
Updater.prototype.getLatestDownloadErrorsStr = function() {
  let errors = '';
  if (this.downloadErrors && this.downloadErrors.length) {
    for (const error of this.downloadErrors) {
      const errType = error.parseError ? 'Parse Error' : 'Download Error';
      errors += `${errType}: ${error.downloadUrl} - ${error.errorMessage}`;
    }
  }
  return errors;
};

/**
 * @typedef {Object} ResourceType
 * @property {String} languageId
 * @property {String} resourceId
 * @property {String} remoteModifiedTime
 * @property {String} downloadUrl
 * @property {String} version
 * @property {String} subject
 * @property {String} owner
 */

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
 * @param {array} filterByOwner - if given, a list of owners to allow for download, updatedCatalogResources and returned list will be limited to these owners
 * @return {
 *          Array.<{
 *                   languageId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   resources: Array.<{ResourceType}>
 *                 }>
 *         }} - list of languages that have updates in catalog (throws exception on error)
 */
Updater.prototype.getLatestResources = async function(localResourceList, filterByOwner= null ) {
  await this.updateCatalog();
  this.updatedCatalogResources = parseHelpers.getLatestResources(this.remoteCatalog, localResourceList, filterByOwner);
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
 * called to cancel a pending download
 */
Updater.prototype.cancelDownload = function() {
  console.warn(`Setting flag to cancel download`);
  this.cancelDownload_ = true;
};

/**
 * called to get current cancel state
 * @return {boolean}
 */
Updater.prototype.getCancelState = function() {
  const downloadCancelled = this.cancelDownload_;
  return downloadCancelled;
};


/**
 * @typedef {Object} ResourceType
 * @property {String} languageId
 * @property {String} resourceId
 * @property {String} remoteModifiedTime
 * @property {String} downloadUrl
 * @property {String} version
 * @property {String} subject
 * @property {String} owner
 */

/**
 * @description Downloads and processes the resources that need to be updated for the given languages using the DCS API
 * @param {Array.<String>} languageList - Array of language codes to download their resources
 * @param {String} resourcesPath - Path to the resources directory where each resource will be placed
 * @param {Array.<ResourceType>} resources - Array of resources that are newer than previously downloaded resources;
 * defaults to this.updatedCatalogResources which was set by previously calling getLatestResources();
 * If getLatestResources() was never called or resources = null, function will get all resources for the given language(s)
 * (the latter is useful for getting all resources for a set of languages, such as including all resources of
 * 'en' and 'hi' in a build)
 * @param {Boolean} allAlignedBibles - if true all aligned Bibles from all languages are updated also
 * @return {Promise} Promise that resolves to return all the resources updated or rejects if a resource failed to download
 */
Updater.prototype.downloadResources = async function(languageList, resourcesPath,
                                                     resources = this.updatedCatalogResources,
                                                     allAlignedBibles = false) {
  if (!resources) {
    await this.getLatestResources([]);
    resources = this.updatedCatalogResources;
  }
  this.downloadErrors = [];
  this.cancelDownload_ = false;
  let results = null;
  const getCancelState = this.getCancelState.bind(this);
  try {
    results = await resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources, this.downloadErrors, allAlignedBibles, getCancelState);
  } catch (e) {
    const errors = this.getLatestDownloadErrorsStr(); // get detailed errors and log
    if (errors) {
      const message = `Source Content Update Errors caught!!!\n${errors}`;
      console.error(message);
    }
    throw e; // return error summary
  }
  console.log('Source Content Update Successful');
  return results;
};

/**
 * @description Downloads and processes each item in resources list along with dependencies that need to be updated using the DCS API
 * @param {String} resourcesPath - Path to the resources directory where each resource will be placed
 * @param {Array.<ResourceType>} resources - Array of resources that are newer than previously downloaded resources;
 * defaults to this.updatedCatalogResources which was set by previously calling getLatestResources();
 * If getLatestResources() was never called or resources = null, function will get all resources for the given language(s)
 * (the latter is useful for getting all resources for a set of languages, such as including all resources of
 * 'en' and 'hi' in a build)
 * @return {Promise<Array|null>} Promise that resolves to return all the resources updated or rejects if a resource failed to download
 */
Updater.prototype.downloadAllResources = async function(resourcesPath,
                                                        resources) {
  if (!resources || !resources.length) {
    console.log('Source Content Update Failed - Resources Empty');
    return null;
  }

  this.cancelDownload_ = false;
  this.downloadErrors = [];
  // generate list of all languages in resources
  const languageList = [];
  for (const resource of resources) {
    const languageId = resource.languageId;
    if (languageId && ! languageList.includes(languageId)) {
      languageList.push(languageId);
    }
  }
  let results = null;
  const getCancelState = this.getCancelState.bind(this);
  try {
    results = await resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources, this.downloadErrors, false, getCancelState);
  } catch (e) {
    const errors = this.getLatestDownloadErrorsStr(); // get detailed errors and log
    if (errors) {
      const message = `Source Content Update Errors caught!!!\n${errors}`;
      console.error(message);
    }
    throw e; // return error summary
  }
  console.log('Source Content Update Successful');
  return results;
};

/**
 * @description move the converted resource to user's resource folder
 * @param {String} resourceSourcePath - Location of selected downloaded resources
 * @param {String} languageCode - language of resource like en or hi
 * @return {Promise} Promise to move directory
 */
Updater.prototype.moveResources = async function(resourceSourcePath, languageCode) {
  const resourceTargetPath = path.join(
    ospath.home(), 'translationCore', 'resources', languageCode);
  return moveResourcesHelpers.move(resourceSourcePath, resourceTargetPath);
};

/**
 * @description Parses the bible package to generate json bible contents, manifest, and index
 * @param {{
 *          languageId: String,
 *          resourceId: String,
 *          localModifiedTime: String,
 *          remoteModifiedTime: String,
 *          downloadUrl: String,
 *          version: String,
 *          subject: String,
 *          catalogEntry: {langResource, bookResource, format}
 *        }} resourceEntry - resource entry for download
 * @param {String} extractedFilesPath - path to unzipped files from bible package
 * @param {String} resultsPath - path to store processed bible
 * @return {Boolean} true if success
 */
Updater.prototype.parseBiblePackage = function(resourceEntry, extractedFilesPath, resultsPath) {
  return packageParseHelpers.parseBiblePackage(resourceEntry, extractedFilesPath, resultsPath);
};

/**
 * @description Processes the extracted files for translationAcademy to create a single file for each
 * article
 * @param {Object} resource Resource object
 * @param {String} extractedFilesPath - Path to the extracted files that came from the zip file in the catalog
 * @param {String} outputPath - Path to place the processed files WITHOUT version in the path
 * @return {String} The path to the processed translationAcademy files with version
 */
Updater.prototype.processTranslationAcademy = function(resource, extractedFilesPath, outputPath) {
  return taArticleHelpers.processTranslationAcademy(resource, extractedFilesPath, outputPath);
};

/**
 * @description Processes the extracted files for translationWord to cerate the folder
 * structure and produce the index.js file for the language with the title of each article.
 * @param {Object} resource Resource object
 * @param {String} extractedFilesPath - Path to the extracted files that came from the zip file from the catalog
 * @param {String} outputPath - Path to place the processed resource files WIHTOUT the version in the path
 * @return {String} Path to the processed translationWords files with version
 */
Updater.prototype.processTranslationWords = function(resource, extractedFilesPath, outputPath) {
  return twArticleHelpers.processTranslationWords(resource, extractedFilesPath, outputPath);
};

/**
 * @description Generates the tW Group Data files from the given aligned Bible
 * @param {Object} resource Resource object
 * @param {string} biblePath Path to the Bible with aligned data
 * @param {string} outputPath Path where the translationWords group data is to be placed WITHOUT version
 * @return {string} Path where tW was generated with version
 */
Updater.prototype.generateTwGroupDataFromAlignedBible = function(resource, biblePath, outputPath) {
  return twGroupDataHelpers.generateTwGroupDataFromAlignedBible(resource, biblePath, outputPath);
};

/**
 * @description Processes the extracted files for translationNotes to separate the folder
 * structure and produce the index.json file for the language with the title of each article.
 * @param {Object} resource - Resource object
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * @param {String} outputPath - Path to place the processed resource files WITHOUT the version in the path
 * @param {String} resourcesPath Path to resources folder
 */
Updater.prototype.processTranslationNotes = function(resource, sourcePath, outputPath, resourcesPath) {
  tnArticleHelpers.processTranslationNotes(resource, sourcePath, outputPath, resourcesPath, this.downloadErrors);
};

/**
 * Downloads a specific resource
 * @param {object} resourceDetails - Details about the resource.
 * { languageId: 'en', resourceId: 'ult', version: 0.8 }
 * @param {string} resourceDetails.languageId The language Id of the resource.
 * @param {string} resourceDetails.resourceId The resource Id of the resource.
 * @param {number} resourceDetails.version The version of the resource.
 * @param {string} resourcesPath - Path to the resources directory where each resource will be placed
 * @return {Promise} Promise that resolves to return all the resources updated or rejects if a resource failed to download.
 */
Updater.prototype.downloadAndProcessResource = async function(resourceDetails, resourcesPath) {
  const {languageId, resourceId, version, owner} = resourceDetails;
  const resourceName = `${languageId}_${resourceId}`;
  const version_ = apiHelpers.formatVersionWithV(version);
  const downloadUrl = `https://git.door43.org/${owner}/${resourceName}/archive/${version_}.zip`;
  const resource = {
    languageId,
    resourceId,
    version: apiHelpers.formatVersionWithoutV(version),
    downloadUrl,
    owner: owner || apiHelpers.DOOR43_CATALOG,
    remoteModifiedTime: '0001-01-01T00:00:00+00:00',
    subject: 'Bible',
    catalogEntry: {
      subject: {},
      resource: {},
      format: {},
    },
  };
  this.downloadErrors = [];
  let result = null;
  try {
    result = await resourcesDownloadHelpers.downloadAndProcessResource(resource, resourcesPath, this.downloadErrors);
    const importsPath = path.join(resourcesPath, 'imports'); // Remove imports folder
    fs.removeSync(importsPath);
  } catch (e) {
    const errors = this.getLatestDownloadErrorsStr(); // get detailed errors and log
    if (errors) {
      const message = `Source Content Update Errors caught!!!\n${errors}`;
      console.error(message);
    }
    throw e; // return error summary
  }
  console.log('Source Content Update Successful');
  return result;
};

export default Updater;
