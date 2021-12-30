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
 * @param owner
 * @param repo
 * @param subject
 * @param item
 */
export function addCsvItem(list, owner, repo, subject, item) {
  const itemJson = JSON.stringify(item).replace('\t', '\\t');
  list.push({owner, repo, subject, resource: itemJson});
  // list.push(`${owner}\t${repo}\t${subject}\t${itemJson}`);
}

/**
 *
 * @param list
 * @param owner
 * @param repo
 * @param subject
 * @param item
 * @param category
 */
export function addCsvItem2(list, owner, repo, subject, item, category, url='') {
  const itemJson = JSON.stringify(item).replace('\t', '\\t').substr(0, 256);
  list.push({category, owner, repo, subject, resource: itemJson, url});
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
    csvLines.push(`${item.owner}\t${item.repo}\t${item.subject}\t${itemJson}`);
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
    csvLines.push(`${item.category}\t${item.owner}\t${item.repo}\t${item.subject}\t${item.url}\t${itemJson}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n') + '\n', 'utf8');
}

/**
 *
 * @param owners
 * @param owner
 * @param csvLines
 */
export function getOrgItems(owners, owner, csvLines) {
  const items = owners[owner];
  for (const item of items) {
    const subject = item.subject;
    const repo = item.name;
    const owner = item.owner;
    addCsvItem(csvLines, owner, repo, subject, item);
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

/**
 *
 * @param reposFormat
 * @param reposLines
 * @param outputFolder
 * @param outputFile
 */
export function writeToTsv(reposFormat, reposLines, outputFolder, outputFile) {
  const lines = [];
  let line = '';
  // write header
  for (const field of reposFormat) {
    const fieldKey = field.key;
    const fieldText = field.text;
    let value = fieldText || fieldKey;
    line += value + '\t';
  }
  lines.push(line);
  for (const repoline of reposLines) {
    let line = '';
    for (const field of reposFormat) {
      const fieldKey = field.key;
      let value = repoline[fieldKey];
      if (typeof(value) === 'object') {
        value = JSON.stringify(value);
      } else if ((value !== 0) && !value) {
        value = '';
      }
      line += value + '\t';
    }
    lines.push(line);
  }
  fs.ensureDirSync(outputFolder);
  const data = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(outputFolder, outputFile), data, 'utf8');
  return data;
}

/**
 *
 * @param reposLines
 * @param sortKey
 * @return {*}
 */
export function sortStringObjects(reposLines, sortKey) {
  const keySort = (a, b) => {
    const x = a[sortKey].toLowerCase();
    const y = b[sortKey].toLowerCase();
    if (x < y) {
      return -1;
    }
    if (x > y) {
      return 1;
    }
    return 0;
  };
  const sorted = reposLines.sort(keySort);
  return sorted;
}

/**
 *
 * @param reposLines
 * @param sortKey
 * @param reverse
 * @return {*}
 */
export function sortObjects(reposLines, sortKey, reverse) {
  const keySort = (a, b) => {
    const x = a[sortKey];
    const y = b[sortKey];
    let result = 0;
    if (x < y) {
      result = -1;
    } else if (x > y) {
      result = 1;
    }
    if (reverse) {
      result = -result;
    }
    return result;
  };
  const sorted = reposLines.sort(keySort);
  return sorted;
}
