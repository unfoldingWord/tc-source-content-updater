/**
 * This script updates the resources in a given directory for the given languages
 * Syntax: node scripts/resources/updateResources.js <path to resources> <language> [language...]
 */
require('babel-polyfill'); // required for async/await
const path = require('path-extra');
const fs = require('fs-extra');
const ResourcesDownloadHelpers = require('./src/helpers/resourcesDownloadHelpers');

/**
 * find resources to update
 * @param {String} downloadUrl - path for resource to download
 * @param {String} destPath - folder to place downloaded resource
 * @return {Boolean} true if success
 */
const getResource = async (downloadUrl, destPath, languageId, resourceId, version) => {
  let success = false;
  const resource = {
    languageId,
    resourceId,
    downloadUrl,
    version,
  };
  const downloadErrors = [];

  try {
    fs.ensureDirSync(destPath);
    await ResourcesDownloadHelpers.downloadAndProcessResource(resource, destPath, downloadErrors)
      .then(async () => {
        console.log(`finished getting ${downloadUrl}`);
      });
    success = downloadErrors.length === 0;
    if (!success) {
      console.error("Download failed", {errors: downloadErrors});
    }
    return success;
  } catch (e) {
    const message = `Error getting latest resources: `;
    console.error(message, e);
    return false;
  }
};

/**
 * get last update resources time
 * @param {String} resourcesPath
 * @return {null|Date}
 */
const getResourceUpdateTime = (resourcesPath) => {
  const sourceContentManifestPath = path.join(resourcesPath, 'source-content-updater-manifest.json');
  let manifest = {};

  if (fs.existsSync(sourceContentManifestPath)) {
    manifest = fs.readJSONSync(sourceContentManifestPath);
  }

  if (manifest && manifest.modified) {
    return new Date(manifest.modified);
  }
  return null;
};

/**
 * iterate through process arguments and separate out flags and other parameters
 * @return {{flags: [], otherParameters: []}}
 */
function separateParams() {
  const flags = [];
  const otherParameters = [];

  for (let i = 2, l = process.argv.length; i < l; i++) {
    const param = process.argv[i];

    if (param.substr(0, 1) === '-') { // see if flag
      flags.push(param);
    } else {
      otherParameters.push(param);
    }
  }
  return { flags, otherParameters };
}

/**
 * see if flag is in flags
 * @param {Array} flags
 * @param {String} flag - flag to match
 * @return {Boolean}
 */
function findFlag(flags, flag) {
  const found = flags.find((item) => (item === flag));
  return !!found;
}

// run as main
if (require.main === module) {
  const {flags, otherParameters} = separateParams();

  if (otherParameters.length < 2) {
    console.error('Syntax: node scripts/resources/updateResources.js [flags] <url_of_resource> <destination_folder>');
    return 1;
  }

  const resourcesPath = otherParameters[0];
  const languages = otherParameters.slice(1);
  const allAlignedBibles = findFlag(flags, '--allAlignedBibles');

  if (! fs.existsSync(resourcesPath)) {
    console.error('Directory does not exist: ' + resourcesPath);
    process.exitCode = 1; // set exit error code
    return;
  }

  // executeResourcesUpdate(languages, resourcesPath, allAlignedBibles).then(code => {
  //   process.exitCode = code; // set exit code, 0 = no error
  // });
}
