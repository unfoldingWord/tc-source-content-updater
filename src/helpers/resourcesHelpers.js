/* eslint-disable no-console,max-len,camelcase */
import fs from 'fs-extra';
import path from 'path-extra';
import yaml from 'yamljs';
import {isObject} from 'util';
import semver from 'semver';
// helpers
import * as zipFileHelpers from './zipFileHelpers';
import * as twArticleHelpers from './translationHelps/twArticleHelpers';
import * as tnArticleHelpers from './translationHelps/tnArticleHelpers';
import * as taArticleHelpers from './translationHelps/taArticleHelpers';
import * as twGroupDataHelpers from './translationHelps/twGroupDataHelpers';
import * as packageParseHelpers from './packageParseHelpers';
// constants
import * as errors from '../resources/errors';
import * as Bible from '../resources/bible';
import {DEFAULT_OWNER, OWNER_SEPARATOR} from './apiHelpers';

export const TRANSLATION_HELPS_INDEX = {
  ta: 'translationAcademy',
  tn: 'translationNotes',
  tw: 'translationWords',
  twl: 'translationWordsLinks',
  tq: 'translationQuestions',
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
    const yamlManifest = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
    manifest = yaml.parse(yamlManifest);
  }
  return manifest;
}

/**
 * Returns an array of versions found in the path that start with [vV]\d
 * @param {String} resourcePath - base path to search for versions
 * @param {string} ownerStr - optional owner to filter by
 * @param {boolean} fallbackToDefaultOwner
 * @return {Array} - array of versions, e.g. ['v1', 'v10', 'v1.1']
 */
export function getVersionsInPath(resourcePath, ownerStr = DEFAULT_OWNER, fallbackToDefaultOwner = false) {
  if (!resourcePath || !fs.pathExistsSync(resourcePath)) {
    return null;
  }

  ownerStr = encodeOwnerStr(ownerStr);

  if (ownerStr[0] !== OWNER_SEPARATOR) { // prefix the separator character if missing
    ownerStr = OWNER_SEPARATOR + ownerStr;
  }

  const isVersionDirectory = (name) => {
    const fullPath = path.join(resourcePath, name);
    let isMatch = fs.lstatSync(fullPath).isDirectory() && name.match(/^v\d/i);
    if (isMatch && ownerStr) { // if we need to filter by owner
      isMatch = name.endsWith(ownerStr);
    }
    return isMatch;
  };
  let versions = sortVersions(fs.readdirSync(resourcePath).filter(isVersionDirectory));
  if ((!versions || !versions.length) && fallbackToDefaultOwner) {
    versions = getVersionsInPath(resourcePath, DEFAULT_OWNER);
  }
  return versions;
}

/**
 * reads files names from folder and remove system files
 * @param {string} path
 * @return {*[]}
 */
export const cleanReaddirSync = (path) => {
  let cleanDirectories = [];

  if (fs.existsSync(path)) {
    cleanDirectories = fs.readdirSync(path)
      .filter((file) => file !== '.DS_Store');
  }

  return cleanDirectories;
};

/**
 * takes path that has version and owner such as `~/resources/bible/v1.1_unfoldingWord` and extracts the version and owner.
 * @param {string} versionPath
 * @return {{owner: string, version: string}}
 */
export function getVersionAndOwnerFromPath(versionPath) {
  if (versionPath) {
    const versionAndOwner = path.base(versionPath, true);
    return splitVersionAndOwner(versionAndOwner);
  }
  return {};
}

/**
 * takes string that has version and owner such as `v1.1_unfoldingWord` and splits into version and owner.
 * @param {string} versionAndOwner
 * @return {{owner: string, version: string}}
 */
export function splitVersionAndOwner(versionAndOwner) {
  let version = versionAndOwner;
  let owner = '';
  const pos = versionAndOwner.indexOf(OWNER_SEPARATOR);
  if (pos >= 0) {
    owner = decodeURIComponent(versionAndOwner.substr(pos + 1));
    version = versionAndOwner.substr(0, pos);
  }
  return {version, owner};
}

/**
 * Returns the versioned folder within the directory with the highest value.
 * e.g. `v10` is greater than `v9`
 * @param {string} dir - the directory to read
 * @return {string} the full path to the latest version directory.
 */
export function getLatestVersionsAndOwners(dir) {
  const versionAndOwners = listVersions(dir, true);
  const orgs = {};

  for (const versionAndOwner of versionAndOwners) {
    const {owner} = splitVersionAndOwner(versionAndOwner);
    if (!orgs[owner]) {
      orgs[owner] = [];
    }
    orgs[owner].push(versionAndOwner);
  }

  const orgsKeys = Object.keys(orgs);
  for (const org of orgsKeys) {
    const versions = orgs[org];
    const latest = path.join(dir, versions[0]);
    orgs[org] = latest;
  }

  if (orgsKeys.length > 0) {
    return orgs;
  } else {
    return null;
  }
}

/**
 * sorts array by version number
 * @param {Array} versionedDirs
 * @param {boolean} inverted - if true then do reverse sort
 * @return {*}
 */
export function sortVersionsByNumber(versionedDirs, inverted = false) {
  if (inverted) {
    return versionedDirs.sort((a, b) =>
      -compareVersions(a, b), // do inverted sort
    );
  }
  return versionedDirs.sort((a, b) =>
    compareVersions(a, b), // do regular sort
  );
}

/**
 * Returns an array of paths found in the directory filtered and sorted by version
 * @param {string} dir
 * @param {boolean} inverted - if true then do reverse sort
 * @return {string[]}
 */
export function listVersions(dir, inverted = false) {
  if (fs.pathExistsSync(dir)) {
    const versionedDirs = fs.readdirSync(dir).filter((file) => fs.lstatSync(path.join(dir, file)).isDirectory() &&
      file.match(/^v\d/i));
    return sortVersionsByNumber(versionedDirs, inverted);
  }
  return [];
}

/**
 * compares version numbers, if a > b returns 1; if a < b return -1; else are equal and return 0
 * @param {String} a
 * @param {String} b
 * @return {number}
 */
export function compareVersions(a, b) {
  const cleanA = semver.coerce(a);
  const cleanB = semver.coerce(b);

  if (semver.gt(cleanA, cleanB)) {
    return 1;
  } else if (semver.lt(cleanA, cleanB)) {
    return -1;
  } else {
    return 0;
  }
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
  // Only sort if all items are strings
  for (let i = 0; i < versions.length; ++i) {
    if (typeof versions[i] !== 'string') {
      return versions;
    }
  }
  versions = sortVersionsByNumber(versions); // sort by standard version order
  return versions;
}

/**
 * Return the full path to the highest version folder in resource path
 * @param {String} resourcePath - base path to search for versions
 * @param {string} ownerStr - optional owner to filter by
 * @param {boolean} fallbackToDefaultOwner - if version not found for owner, then fall back to using default owner
 * @return {String} - path to highest version
 */
export function getLatestVersionInPath(resourcePath, ownerStr = DEFAULT_OWNER, fallbackToDefaultOwner= false) {
  const versions = getVersionsInPath(resourcePath, ownerStr, fallbackToDefaultOwner);
  if (versions && versions.length) {
    // versions = sortVersions(versions);
    return path.join(resourcePath, versions[versions.length - 1]);
  }
  return null; // return illegal path
}

/**
 * returns the highest version for array that matches owner
 * @param {Array} versions - base path to search for versions
 * @param {string} ownerStr - optional owner to filter by, default to DOOR43_CATALOG
 * @return {String} - highest version
 */
export function getLatestVersionFromList(versions, ownerStr = DEFAULT_OWNER) {
  if (Array.isArray(versions)) {
    if (versions.length) {
      ownerStr = encodeOwnerStr(ownerStr);

      if (ownerStr[0] !== OWNER_SEPARATOR) { // prefix the separator character if missing
        ownerStr = OWNER_SEPARATOR + ownerStr;
      }

      versions = versions.filter(version => version.endsWith(ownerStr));
      versions = sortVersions(versions); // sort by standard version order
      return versions[versions.length - 1];
    }
  }
  return null;
}

/**
 * @description Unzips a resource's zip file to an imports directory for processing
 * @param {Object} resource Resource object containing resourceId and languageId
 * @param {String} zipFilePath Path to the zip file
 * @param {string} resourcesPath Path to the resources directory
 * @return {String} Path to the resource's import directory
 */
export const unzipResource = async (resource, zipFilePath, resourcesPath) => {
  const importsPath = path.join(resourcesPath, 'imports');
  fs.ensureDirSync(importsPath);
  const importPath = zipFilePath.split('.').slice(0, -1).join('.');
  await zipFileHelpers.extractZipFile(zipFilePath, importPath);
  return importPath;
};

/**
 * Gets the single subdirectory of an extracted zip file path
 * @param {String} extractedFilesPath Extracted files path
 * @return {String} The subdir in the extracted path
 */
export function getSubdirOfUnzippedResource(extractedFilesPath) {
  const subdirs = fs.readdirSync(extractedFilesPath);
  if (subdirs.length === 1 && fs.lstatSync(path.join(extractedFilesPath, subdirs[0])).isDirectory()) {
    return path.join(extractedFilesPath, subdirs[0]);
  }
  return extractedFilesPath;
}

/**
 * @description Processes a resource in the imports directory as needed
 * @param {Object} resource Resource object
 * @param {String} sourcePath Path to the source dictory of the resource
 * @param {String} resourcesPath Path to user resources folder
 * @return {String} Path to the directory of the processed files
 * @param {Array} downloadErrors - parsed list of download errors with details such as if the download completed (vs. parsing error), error, and url
 * @param {object} latestManifestKey - for resource type make sure manifest key is at specific version, by subject
 */
export async function processResource(resource, sourcePath, resourcesPath, downloadErrors, latestManifestKey = {}) {
  try {
    if (!resource || !isObject(resource) || !resource.languageId || !resource.resourceId) {
      throw Error(formatError(resource, errors.RESOURCE_NOT_GIVEN));
    }
    if (!sourcePath) {
      throw Error(formatError(resource, errors.SOURCE_PATH_NOT_GIVEN));
    }
    if (!fs.pathExistsSync(sourcePath)) {
      throw Error(formatError(resource, errors.SOURCE_PATH_NOT_EXIST));
    }

    const processedFilesPath = sourcePath + '_processed';
    fs.ensureDirSync(processedFilesPath);

    switch (resource.subject) {
      case 'Translation_Words':
        twArticleHelpers.processTranslationWords(resource, sourcePath, processedFilesPath);
        break;
      case 'TSV_Translation_Words_Links':
        await twArticleHelpers.processTranslationWordsTSV(resource, sourcePath, processedFilesPath, resourcesPath, downloadErrors);
        break;
      case 'TSV_Translation_Notes':
        await tnArticleHelpers.processTranslationNotes(resource, sourcePath, processedFilesPath, resourcesPath, downloadErrors);
        break;
      case 'Translation_Academy':
        taArticleHelpers.processTranslationAcademy(resource, sourcePath, processedFilesPath);
        break;
      case 'Bible':
      case 'Aligned_Bible':
      case 'Greek_New_Testament':
      case 'Hebrew_Old_Testament':
        packageParseHelpers.parseBiblePackage(resource, sourcePath, processedFilesPath, latestManifestKey);
        break;
      default:
        fs.copySync(sourcePath, processedFilesPath);
    }

    let manifest = getResourceManifest(processedFilesPath);
    if (!manifest) { // if manifest not found, create
      manifest = getResourceManifest(sourcePath);
      if (manifest) {
        if (resource.version) {
          manifest.version = resource.version;
        }
        manifest.modifiedTime = manifest.catalog_modified_time = resource.remoteModifiedTime;
        fs.outputJsonSync(path.join(processedFilesPath, 'manifest.json'), manifest, {spaces: 2});
      }
    } else { // if manifest found, make sure it has the version and data from catalog next
      if (resource.version) {
        manifest.version = resource.version;
      }
      manifest.modifiedTime = manifest.catalog_modified_time = resource.remoteModifiedTime;
      fs.outputJsonSync(path.join(processedFilesPath, 'manifest.json'), manifest, {spaces: 2});
    }

    return processedFilesPath;
  } catch (error) {
    console.error(error);
    throw Error(appendError(errors.FAILED_TO_PROCESS_RESOURCE, error));
  }
}

/**
 * encode owner to string without characters unsupported by file system
 * @param {string} owner
 * @return {string}
 */
export function encodeOwnerStr(owner) {
  const ownerStr = encodeURIComponent(owner || '');
  return ownerStr;
}

/**
 * combine owner with key
 * @param {string} key
 * @param {string} owner
 * @return {string|*}
 */
export function addOwnerToKey(key, owner) {
  const ownerStr = encodeOwnerStr(owner);
  const versionDir = ownerStr ? `${key}${OWNER_SEPARATOR}${ownerStr}` : key;
  return versionDir;
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
  let type = 'bibles';
  if (TRANSLATION_HELPS_INDEX[resourceName]) {
    resourceName = TRANSLATION_HELPS_INDEX[resourceName];
    type = 'translationHelps';
  }
  const version = 'v' + resource.version;
  const versionDir = addOwnerToKey(version, resource.owner);
  const actualResourcePath = path.join(resourcesPath, languageId, type, resourceName, versionDir);
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
 * @param {String} sourcePath Path to the Bible directory
 * @return {String} Path to the processed tw Group Data files
 */
export function makeTwGroupDataResource(resource, sourcePath) {
  if (!resource) {
    throw Error(formatError(resource, errors.RESOURCE_NOT_GIVEN));
  }
  if (!fs.pathExistsSync(sourcePath)) {
    throw Error(formatError(resource, errors.SOURCE_PATH_NOT_EXIST));
  }
  if ((resource.languageId === Bible.NT_ORIG_LANG && resource.resourceId === Bible.NT_ORIG_LANG_BIBLE) ||
      (resource.languageId === Bible.OT_ORIG_LANG && resource.resourceId === Bible.OT_ORIG_LANG_BIBLE)) {
    const twGroupDataPath = path.join(sourcePath + '_tw_group_data_' + resource.languageId + '_v' + resource.version);
    const result = twGroupDataHelpers.generateTwGroupDataFromAlignedBible(resource, sourcePath, twGroupDataPath);
    if (result) {
      return twGroupDataPath;
    }
  }
}

/**
 * Removes all version directories except the latest
 * @param {String} resourcePath Path to the resource directory that has subdirs of versions
 * @param {array} versionsToNotDelete List of versions not to be deleted.
 * @param {string} ownerStr - optional owner to filter by
 * @return {Boolean} True if versions were deleted, false if nothing was touched
 */
export function removeAllButLatestVersion(resourcePath, versionsToNotDelete = [], ownerStr = '') {
  // Remove the previous version(s)
  const versionDirs = getVersionsInPath(resourcePath, ownerStr);
  if (versionDirs && versionDirs.length > 1) {
    const lastVersion = versionDirs[versionDirs.length - 1];
    versionDirs.forEach((versionDir) => {
      if (versionDir !== lastVersion && !versionsToNotDelete.includes(versionDir)) {
        const versionPath = path.join(resourcePath, versionDir);
        console.log(`removeAllButLatestVersion() - removing old resource: ${versionPath}`);
        fs.removeSync(versionPath);
      }
    });
    return true;
  }
  return false;
}

/**
 * @description Formats an error for all resources to have a standard format
 * @param {Object} resource Resource object
 * @param {String} errMessage Error message
 * @return {String} The formatted error message
 */
export function formatError(resource, errMessage) {
  if (!resource || !isObject(resource) || !resource.languageId || !resource.resourceId) {
    resource = {
      languageId: 'unknown',
      resourceId: 'unknown',
    };
  }
  return resource.owner + '/' + resource.languageId + '_' + resource.resourceId + ': ' + errMessage;
}

/**
 *  converts error to string
 * @param {Error|String} error - error to append
 * @return {string} concatenated message
 */
export function getErrorMessage(error) {
  return ((error && error.message) || error || 'UNDEFINED');
}

/**
 * appends error message to string
 * @param {string} str - string to use as prefix
 * @param {Error|String} err - error to append
 * @return {string} concatenated message
 */
export function appendError(str, err) {
  return str + ': ' + getErrorMessage(err);
}

/**
 * Determines if the rootpath plus a filename is a directory.
 * @param {string} rootPath
 * @param {string} filename
 * @return {bool} - Whether the path is a directory or not.
 */
export const isDirectory = (rootPath, filename) => {
  const fullPath = path.join(rootPath, filename);
  return fs.lstatSync(fullPath).isDirectory();
};
