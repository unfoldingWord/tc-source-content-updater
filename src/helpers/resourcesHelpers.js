/* eslint-disable no-console,max-len */
import fs from 'fs-extra';
import path from 'path-extra';
import yaml from 'yamljs';
import tmp from 'tmp';
// helpers
import * as zipFileHelpers from './zipFileHelpers';

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
 * @param {String} zipFile Path to the zip file
 * @param {string} resourcesPath Path to the resources directory
 * @return {String} Path to the resource's import directory
 */
export function unzipResource(resource, zipFile, resourcesPath) {
  const importsPath = path.join(resourcesPath, 'imports');
  fs.mkdirpSync(importsPath);
  const importPathObj = tmp.dirSync({
    dir: importsPath,
    prefix: resource.languageId + '_' + resource.resourceId + '_',
    keep: true
  });
  zipFileHelpers.extractZipFile(zipFile, importPathObj.name);
  return importPathObj.name;
}

/**
 * @description Processes a resource in the imports directory as needed
 * @param {Object} resource Resource object
 * @param {String} importPath Path the the import directory of this resource
 * @return {Boolean} True if sucess
 */
export function processResource(resource, importPath) {
  return true;
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
  return path.join(resourcesPath, languageId, type, resourceName);
}

/**
 * @description transfer an entire resource from source to target directory
 * @param {String} resourceSourcePath Current position of resource
 * @param {String} resourceTargetPath Folder where resources are moved
 */
export function moveResource(resourceSourcePath, resourceTargetPath) {
  if (resourceSourcePath && resourceSourcePath.length && resourceTargetPath && resourceTargetPath.length) {
    fs.ensureDirSync(path.dirname(resourceTargetPath));
    fs.moveSync(resourceSourcePath, resourceTargetPath);
  } else {
    throw Error('Invalid parameters to moveResource');
  }
}
