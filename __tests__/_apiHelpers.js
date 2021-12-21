//
// helpers for testing
//

import fs from 'fs-extra';
import path from 'path-extra';
import os from 'os';
import semver from 'semver';

const HOME_DIR = os.homedir();
const USER_RESOURCES_PATH = path.join(HOME_DIR, 'translationCore/resources');
const TRANSLATION_HELPS = 'translationHelps';
// const searchForLangAndBook = `https://git.door43.org/api/v1/repos/search?q=hi%5C_%25%5C_act%5C_book&sort=updated&order=desc&limit=30`;
export const QUOTE_MARK = '\u2019';

/**
 *
 * @param list
 * @param org
 * @param repo
 * @param subject
 * @param item
 */
export function addCsvItem(list, org, repo, subject, item) {
  const itemJson = JSON.stringify(item).replace('\t', '\\t');
  list.push({org, repo, subject, resource: itemJson});
  // list.push(`${org}\t${repo}\t${subject}\t${itemJson}`);
}

/**
 *
 * @param list
 * @param org
 * @param repo
 * @param subject
 * @param item
 * @param category
 */
export function addCsvItem2(list, org, repo, subject, item, category) {
  const itemJson = JSON.stringify(item).replace('\t', '\\t').substr(0, 256);
  list.push({category, org, repo, subject, resource: itemJson});
  // list.push(`${org}\t${repo}\t${subject}\t${itemJson}`);
}

/**
 *
 * @param filename
 * @param list
 */
export function writeCsv(filename, list) {
  const csvLines = [];
  for (const item of list) {
    const itemJson = JSON.stringify(item.resource).replace('\t', '\\t');
    csvLines.push(`${item.org}\t${item.repo}\t${item.subject}\t${itemJson}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n') + '\n', 'utf8');
}

/**
 *
 * @param filename
 * @param list
 */
export function writeCsv2(filename, list) {
  const csvLines = [];
  for (const item of list) {
    const itemJson = JSON.stringify(item.resource).replace('\t', '\\t');
    csvLines.push(`${item.category}\t${item.org}\t${item.repo}\t${item.subject}\t${itemJson}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n') + '\n', 'utf8');
}

/**
 *
 * @param orgs
 * @param org
 * @param csvLines
 */
export function getOrgItems(orgs, org, csvLines) {
  const items = orgs[org];
  for (const item of items) {
    const subject = item.subject;
    const repo = item.name;
    const org = item.owner;
    addCsvItem(csvLines, org, repo, subject, item);
  }
}

const cleanReaddirSync = (path) => {
  let cleanDirectories = [];

  if (fs.existsSync(path)) {
    cleanDirectories = fs.readdirSync(path)
      .filter((file) => file !== '.DS_Store');
  } else {
    console.warn(`no such file or directory, ${path}`);
  }

  return cleanDirectories;
};

const EMPTY_TIME = '0001-01-01T00:00:00+00:00';

/**
 *
 * @param resourcesPath
 * @return {null|*[]}
 */
export const getLocalResourceList = (resourcesPath = USER_RESOURCES_PATH) => {
  try {
    if (!fs.existsSync(resourcesPath)) {
      fs.ensureDirSync(resourcesPath);
    }

    const localResourceList = [];
    const resourceLanguages = fs.readdirSync(resourcesPath)
      .filter((file) => path.extname(file) !== '.json' && file !== '.DS_Store');

    for (let i = 0; i < resourceLanguages.length; i++) {
      const languageId = resourceLanguages[i];
      const biblesPath = path.join(resourcesPath, languageId, 'bibles');
      const tHelpsPath = path.join(resourcesPath, languageId, TRANSLATION_HELPS);
      const bibleIds = cleanReaddirSync(biblesPath);
      const tHelpsResources = cleanReaddirSync(tHelpsPath);

      bibleIds.forEach((bibleId) => {
        const bibleIdPath = path.join(biblesPath, bibleId);
        const bibleLatestVersion = getLatestVersion(bibleIdPath);

        if (bibleLatestVersion) {
          const pathToBibleManifestFile = path.join(bibleLatestVersion, 'manifest.json');

          if (fs.existsSync(pathToBibleManifestFile)) {
            const resourceManifest = fs.readJsonSync(pathToBibleManifestFile);
            const remoteModifiedTime = (resourceManifest.remoteModifiedTime !== EMPTY_TIME) && resourceManifest.remoteModifiedTime;
            const localResource = {
              languageId: languageId,
              resourceId: bibleId,
              version: path.base(bibleLatestVersion, true),
              modifiedTime: remoteModifiedTime || resourceManifest.catalog_modified_time,
            };

            localResourceList.push(localResource);
          } else {
            console.warn(`no such file or directory, ${pathToBibleManifestFile}`);
          }
        } else {
          console.log(`$bibleLatestVersion is ${bibleLatestVersion}.`);
        }
      });

      tHelpsResources.forEach((tHelpsId) => {
        const tHelpResource = path.join(tHelpsPath, tHelpsId);
        const tHelpsLatestVersion = getLatestVersion(tHelpResource);

        if (tHelpsLatestVersion) {
          const pathTotHelpsManifestFile = path.join(tHelpsLatestVersion, 'manifest.json');

          if (fs.existsSync(pathTotHelpsManifestFile)) {
            const resourceManifest = fs.readJsonSync(pathTotHelpsManifestFile);
            const localResource = {
              languageId: languageId,
              resourceId: tHelpsId,
              modifiedTime: resourceManifest.catalog_modified_time,
            };

            localResourceList.push(localResource);
          } else {
            console.warn(`no such file or directory, ${pathTotHelpsManifestFile}`);
          }
        } else {
          console.log(`$tHelpsLatestVersion is ${tHelpsLatestVersion}.`);
        }
      });
    }
    return localResourceList;
  } catch (error) {
    console.error(error);
    return null;
  }
};

/**
 * Returns the versioned folder within the directory with the highest value.
 * e.g. `v10` is greater than `v9`
 * @param {string} dir - the directory to read
 * @return {string} the full path to the latest version directory.
 */
export function getLatestVersion(dir) {
  const versions = listVersions(dir);

  if (versions.length > 0) {
    return path.join(dir, versions[0]);
  } else {
    return null;
  }
}

/**
 * Returns an array of paths found in the directory filtered and sorted by version
 * @param {string} dir
 * @return {string[]}
 */
function listVersions(dir) {
  if (fs.pathExistsSync(dir)) {
    const versionedDirs = fs.readdirSync(dir).filter((file) => fs.lstatSync(path.join(dir, file)).isDirectory() &&
      file.match(/^v\d/i));
    return versionedDirs.sort((a, b) =>
      -compareVersions(a, b), // do inverted sort
    );
  }
  return [];
}

/**
 * compares version numbers, if a > b returns 1; if a < b return -1; else are equal and return 0
 * @param a
 * @param b
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
 * @description This helper method generates a timestamp in milliseconds for use
 *              in the storing of data in the app. Timestamps will be used to
 *              generate filenames and modified dates.
 * @param {String} str A date string. If null, will be current date
 * @return {String} The timestamp in milliseconds
 ******************************************************************************/
export const generateTimestamp = (str) => {
  if (!str) {
    return (new Date()).toJSON();
  } else {
    return (new Date(str)).toJSON();
  }
};

export function dateToFileName(str) {
  let fileName = generateTimestamp(str);
  fileName = fileName.replace(/[:"]/g, '_');
  return fileName;
}

export function saveResources(outputFolder, data, tag) {
  // const fileName = `localResources-${dateToFileName()}.json`;
  const fileName = `localResources-${tag}.json`;
  fs.ensureDirSync(outputFolder);
  const outputPath = path.join(outputFolder, fileName);
  fs.outputJSONSync(outputPath, data);
  return outputPath;
}
