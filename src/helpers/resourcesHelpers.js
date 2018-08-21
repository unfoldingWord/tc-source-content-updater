/* eslint-disable no-console,max-len */
import fs from 'fs-extra';
import path from 'path-extra';
import yaml from 'yamljs';
// helpers
import * as zipFileHelpers from './zipFileHelpers';
import * as twArticleHelpers from './translationHelps/twArticleHelpers';
import * as taArticleHelpers from './translationHelps/taArticleHelpers';
import * as twGroupDataHelpers from './translationHelps/twGroupDataHelpers';
import * as packageParseHelpers from './packageParseHelpers';

const translationHelps = {
  ta: 'translationAcademy',
  tn: 'translationNotes',
  tw: 'translationWords',
  tq: 'translationQuestions'
};

/**
 * @description - Gets the version from the manifest
 * @param {String} resourcePath - folder for manifest.json or yaml
 * @return {String} version
 */
export function getVersionFromManifest(resourcePath) {
  const manifest = getResourceManifest(resourcePath);
  if (!manifest || !manifest.dublin_core || !manifest.dublin_core.version) {
    return null;
  }
  return manifest.dublin_core.version;
}

/**
 * @description Helper function to get manifest file from the resources folder. First
 * it will try manifest.json, then manifest.yaml.
 * @param {String} resourcePath - path to a resource folder which contains the manifest file in its root.
 * @return {Object} manifest
 */
export function getResourceManifest(resourcePath) {
  const manifest = getResourceManifestFromJson(resourcePath);
  if (!manifest) {
    return getResourceManifestFromYaml(resourcePath);
  }
  return manifest;
}

/**
 * @description - Turns a manifest.json file into an object and returns it, null if doesn't exist
 * @param {String} resourcePath - folder for manifest.json
 * @return {Object} manifest
 */
export function getResourceManifestFromJson(resourcePath) {
  const fileName = 'manifest.json';
  const manifestPath = path.join(resourcePath, fileName);
  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    manifest = fs.readJsonSync(manifestPath);
  }
  return manifest;
}

/**
 * @description - Turns a manifest.yaml file into an object and returns it, null if doesn't exist
 * @param {String} resourcePath - folder for manifest.yaml
 * @return {Object} manifest
 */
export function getResourceManifestFromYaml(resourcePath) {
  const fileName = 'manifest.yaml';
  const manifestPath = path.join(resourcePath, fileName);
  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    const yamlManifest = fs.readFileSync(manifestPath, 'utf8');
    manifest = yaml.parse(yamlManifest);
  }
  return manifest;
}

/**
 * Returns an array of versions found in the path that start with [vV]\d
 * @param {String} resourcePath - base path to search for versions
 * @return {Array} - array of versions, e.g. ['v1', 'v10', 'v1.1']
 */
export function getVersionsInPath(resourcePath) {
  if (!resourcePath || !fs.pathExistsSync(resourcePath)) {
    return null;
  }
  const isVersionDirectory = name => {
    const fullPath = path.join(resourcePath, name);
    return fs.lstatSync(fullPath).isDirectory() && name.match(/^v\d/i);
  };
  return fs.readdirSync(resourcePath).filter(isVersionDirectory);
}

/**
 * Returns a sorted an array of versions so that numeric parts are properly ordered (e.g. v10a < v100)
 * @param {Array} versions - array of versions unsorted: ['v05.5.2', 'v5.5.1', 'V6.21.0', 'v4.22.0', 'v6.1.0', 'v6.1a.0', 'v5.1.0', 'V4.5.0']
 * @return {Array} - array of versions sorted:  ["V4.5.0", "v4.22.0", "v5.1.0", "v5.5.1", "v05.5.2", "v6.1.0", "v6.1a.0", "V6.21.0"]
 */
export function sortVersions(versions) {
  // Don't sort if null, empty or not an array
  if (!versions || !Array.isArray(versions)) {
    return versions;
  }
  // Only sort of all items are strings
  for (let i = 0; i < versions.length; ++i) {
    if (typeof versions[i] !== 'string') {
      return versions;
    }
  }
  versions.sort((a, b) => String(a).localeCompare(b, undefined, {numeric: true}));
  return versions;
}

/**
 * Return the full path to the highest version folder in resource path
 * @param {String} resourcePath - base path to search for versions
 * @return {String} - path to highest version
 */
export function getLatestVersionInPath(resourcePath) {
  const versions = sortVersions(getVersionsInPath(resourcePath));
  if (versions && versions.length) {
    return path.join(resourcePath, versions[versions.length - 1]);
  }
  return null; // return illegal path
}

/**
 * @description Unzips a resource's zip file to an imports directory for processing
 * @param {Object} resource Resource object containing resourceId and languageId
 * @param {String} zipFilePath Path to the zip file
 * @param {string} resourcesPath Path to the resources directory
 * @return {String} Path to the resource's import directory
 */
export function unzipResource(resource, zipFilePath, resourcesPath) {
  const importsPath = path.join(resourcesPath, 'imports');
  fs.ensureDirSync(importsPath);
  const importPath = zipFilePath.split('.').slice(0, -1).join('.');
  zipFileHelpers.extractZipFile(zipFilePath, importPath);
  return importPath;
}

/**
 * @description Processes a resource in the imports directory as needed
 * @param {Object} resource Resource object
 * @param {String} extractedFilesPath Path the the import directory of this resource
 * @return {String} Path to the directory of the processed files
 */
export function processResource(resource, extractedFilesPath) {
  const processedFilesPath = extractedFilesPath + '_processed';
  fs.ensureDirSync(processedFilesPath);
  console.log(resource);
  switch (resource.subject) {
    case 'Translation_Words':
      twArticleHelpers.processTranslationWords(extractedFilesPath, processedFilesPath);
      break;
    case 'Translation_Academy':
      taArticleHelpers.processTranslationAcademy(extractedFilesPath, processedFilesPath);
      break;
    case 'Bible':
    case 'Aligned_Bible':
    case 'Greek_New_Testament':
      packageParseHelpers.parseBiblePackage(resource, extractedFilesPath, processedFilesPath);
      break;
    default:
      fs.copySync(extractedFilesPath, processedFilesPath);
  }
  return processedFilesPath;
}

/**
 * @description Gets the actual path to a resource based on the resource object
 * @param {Object} resource The resource object
 * @param {String} resourcesPath The path to the resources directory
 * @return {String} The resource path
 */
export function getActualResourcePath(resource, resourcesPath) {
  const languageId = resource.languageId;
  let resourceName = resource.resourceId;
  let type = 'bible';
  if (translationHelps[resourceName]) {
    resourceName = translationHelps[resourceName];
    type = 'translationHelps';
  }
  const actualResourcePath = path.join(resourcesPath, languageId, type, resourceName, 'v' + resource.version);
  fs.ensureDirSync(actualResourcePath);
  return actualResourcePath;
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
 * @param {String} bibleFilesPath Path to the Bible directory
 * @return {String} Path to the tW Group Data files
 */
export function makeTwGroupDataResource(resource, bibleFilesPath) {
  if ((resource.languageId === 'grc' && resource.resourceId === 'ugnt') ||
      (resource.languageId === 'hbo' && resource.resourceId === 'uhb')) {
    const twGroupDataPath = path.join(bibleFilesPath + '_tw_group_data_' + resource.languageId + '_v' + resource.version);
    twGroupDataHelpers.generateTwGroupDataFromAlignedBible(bibleFilesPath, twGroupDataPath);
    return twGroupDataPath;
  }
}
