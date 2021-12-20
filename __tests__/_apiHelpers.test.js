// this is just a development playbox
// for validating switch to Catalog Next APIs

import fs from 'fs-extra';
import path from 'path-extra';
import os from 'os';
import semver from 'semver';
// import nock from 'nock';
import * as apiHelpers from '../src/helpers/apiHelpers';
import Updater from '../src';

// require('os').homedir()

jest.unmock('fs-extra');
jest.unmock('../src/helpers/downloadHelpers');
jest.unmock('../src/helpers/zipFileHelpers');

const HOME_DIR = os.homedir();
const USER_RESOURCES_PATH = path.join(HOME_DIR, 'translationCore/resources');
const TRANSLATION_HELPS = 'translationHelps';
// const searchForLangAndBook = `https://git.door43.org/api/v1/repos/search?q=hi%5C_%25%5C_act%5C_book&sort=updated&order=desc&limit=30`;
export const QUOTE_MARK = '\u2019';

// // disable nock failed
// nock.restore();
// nock.cleanAll();

describe('test API', () => {
  it('test Updater', async () => {
    const resourcesPath = './temp/updates';
    const sourceContentUpdater = new Updater();
    const localResourceList = getLocalResourceList(resourcesPath);
    const initialResourceList = saveResources(resourcesPath, localResourceList, 'initial');
    await sourceContentUpdater.getLatestResources(localResourceList)
      .then(async (updatedLanguages) => {
        saveResources(resourcesPath, updatedLanguages, 'updated');
        // console.log(sourceContentUpdater.updatedCatalogResources);
        await sourceContentUpdater.downloadResources(['en'], resourcesPath);
        console.log(updatedLanguages);
        const localResourceList = getLocalResourceList(resourcesPath);
        const finalResourceList = saveResources(resourcesPath, localResourceList, 'final');
        console.log('stuff');
      })
      .catch((err) => {
        console.error('Local Resource List:', err);
      });
  }, 600000);
});

describe.skip('apiHelpers.getCatalog', () => {
  it('should get the resulting catalog', () => {
    return apiHelpers.getCatalog().then((res) => {
      expect(res).toMatchObject({
        catalogs: expect.any(Array),
        subjects: expect.any(Array),
      });
      const items = res && res.subjects;
      console.log(`D43 Catalog returned ${items.length} total items`);
      const csvLines = [];
      const org = 'Door43-Catalog';
      for (const item of items) {
        const language = item.language;
        for (const resource of item.resources) {
          const resId = resource.identifier;
          const subject = resource.subject;
          const repo = `${language}_${resId}`;
          addCsvItem(csvLines, org, repo, subject, resource);
        }
      }
      console.log(`D43 Catalog flattened has ${csvLines.length} total items`);
      writeCsv('./temp/CatalogOld.tsv', csvLines);
    });
  });
});

describe.skip('apiHelpers compare pivoted.json with CN', () => {
  it('should make a merged CSV', async () => {
    const res = await apiHelpers.getCatalog();
    expect(res).toMatchObject({
      catalogs: expect.any(Array),
      subjects: expect.any(Array),
    });
    const items = res && res.subjects;
    console.log(`D43 Catalog returned ${items.length} total items`);
    const csvLines = [];
    const org = 'Door43-Catalog';
    const oldCatalog = 'Old';
    for (const item of items) {
      const language = item.language;
      for (const resource of item.resources) {
        const resId = resource.identifier;
        const subject = resource.subject;
        const repo = `${language}_${resId}`;
        addCsvItem2(csvLines, org, repo, subject, resource, oldCatalog);
      }
    }
    console.log(`D43 Catalog flattened has ${csvLines.length} total items`);
    writeCsv('./temp/CatalogOld.tsv', csvLines);

    const latestD43Catalog = 'http://git.door43.org/api/catalog/v5?owner=Door43-Catalog&stage=latest';
    const data = await apiHelpers.doMultipartQuery(latestD43Catalog);
    console.log(`Catalog Next Found ${data.length} total items`);
    expect(data.length).toBeTruthy();
    const cnCatalog = 'CN';
    const cnCatalogCombined = 'CN+Old';
    for (const item of data) {
      const subject = item.subject;
      const repo = item.name;
      const org = item.owner;
      const pos = csvLines.findIndex((line) => ((line.repo === repo) && (line.org === org)));
      if (pos >= 0) {
        const line = csvLines[pos];
        if (line.category === oldCatalog) {
          line.category = cnCatalogCombined;
        } else {
          console.log(JSON.stringify(line));
        }
      } else {
        addCsvItem2(csvLines, org, repo, subject, item, cnCatalog);
      }
    }

    writeCsv2('./temp/Catalog-CN-and-Old.tsv', csvLines);
    console.log('done');
  }, 10000);
});

describe.skip('apiHelpers.getCatalogCN', () => {
  it('should get the CN catalog', async () => {
    const filteredSearch = 'https://git.door43.org/api/catalog/v5/search?subject=Bible%2CAligned%20Bible%2CGreek_New_Testament%2CHebrew_Old_Testament%2CTranslation%20Words%2CTranslation%20Notes%2CTranslation%20Academy&sort=subject&limit=50';
    const unFilteredSearch = 'https://git.door43.org/api/catalog/v5/search?sort=subject&limit=50';
    // const latestD43Catalog = 'https://git.door43.org/api/catalog/v5/search/Door43-Catalog?stage=latest&limit=50';
    const latestD43Catalog = 'http://qa.door43.org/api/catalog/v5?owner=Door43-Catalog&stage=latest';
    const data = await apiHelpers.doMultipartQuery(unFilteredSearch);
    console.log(`Catalog Next Found ${data.length} total items`);
    expect(data.length).toBeTruthy();
    const orgs = {};
    for (let i = 0, l = data.length; i < l; i++) {
      const item = data[i];
      const org = item && item.repo && item.repo.owner && item.repo.owner.login || null;
      if (org) {
        if (!orgs[org]) {
          orgs[org] = [];
        }
        orgs[org].push(item);
      } else {
        console.log(`missing org in ${JSON.stringify(item)}`);
      }
    }
    const orgList = Object.keys(orgs);
    for (const org of orgList) {
      console.log(`${org} has ${orgs[org].length} items`);
    }

    let csvLines = [];
    const org = 'Door43-Catalog';
    getOrgItems(orgs, org, csvLines);
    console.log(`D43 Catalog flattened has ${csvLines.length} total items`);
    writeCsv('./temp/CatalogCN-D43.tsv', csvLines);

    csvLines = [];
    for (const org of orgList) {
      getOrgItems(orgs, org, csvLines);
    }
    console.log(`Catalog Next flattened has ${csvLines.length} total items`);
    writeCsv('./temp/CatalogCN.tsv', csvLines);
  });
}, 10000);

//
// helpers
//

/**
 *
 * @param list
 * @param org
 * @param repo
 * @param subject
 * @param item
 */
function addCsvItem(list, org, repo, subject, item) {
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
function addCsvItem2(list, org, repo, subject, item, category) {
  const itemJson = JSON.stringify(item).replace('\t', '\\t');
  list.push({category, org, repo, subject, resource: itemJson});
  // list.push(`${org}\t${repo}\t${subject}\t${itemJson}`);
}

/**
 *
 * @param filename
 * @param list
 */
function writeCsv(filename, list) {
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
function writeCsv2(filename, list) {
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
function getOrgItems(orgs, org, csvLines) {
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
            const localResource = {
              languageId: languageId,
              resourceId: bibleId,
              version: path.base(bibleLatestVersion),
              modifiedTime: resourceManifest.catalog_modified_time,
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

function saveResources(outputFolder, data, tag) {
  // const fileName = `localResources-${dateToFileName()}.json`;
  const fileName = `localResources-${tag}.json`;
  fs.ensureDirSync(outputFolder);
  const outputPath = path.join(outputFolder, fileName);
  fs.outputJSONSync(outputPath, data);
  return outputPath
}
