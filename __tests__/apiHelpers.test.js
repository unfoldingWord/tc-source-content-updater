// this is just a development playbox

import fs from 'fs-extra';
import path from 'path-extra';
import os from 'os';
import * as apiHelpers from '../src/helpers/apiHelpers';
import Updater from '../src';
import semver from 'semver';
import {getSubdirOfUnzippedResource, unzipResource} from '../src/helpers/resourcesHelpers';
import {download} from '../src/helpers/downloadHelpers';

// require('os').homedir()

jest.unmock('fs-extra');
jest.unmock('../src/helpers/downloadHelpers');
jest.unmock('../src/helpers/zipFileHelpers');

const HOME_DIR = os.homedir();
const USER_RESOURCES_PATH = path.join(HOME_DIR, 'translationCore/resources');
const TRANSLATION_HELPS = 'translationHelps';

describe('apiHelpers.getCatalog', () => {
  it('should get the resulting catalog', () => {
    return apiHelpers.getCatalog().then(res => {
      expect(res).toMatchObject({
        catalogs: expect.any(Array),
        subjects: expect.any(Array)
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
      writeCsv('./CatalogOld.tsv', csvLines);
    });
  });
});

describe('apiHelpers compare pivoted.json with CN', () => {
  it('should make a merged CSV', async () => {
    const res = await apiHelpers.getCatalog();
    expect(res).toMatchObject({
      catalogs: expect.any(Array),
      subjects: expect.any(Array)
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
    writeCsv('./CatalogOld.tsv', csvLines);

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
      const pos = csvLines.findIndex(line => ((line.repo === repo) && (line.org === org)));
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

    writeCsv2('./Catalog-CN-and-Old.tsv', csvLines);
    console.log('done');

  }, 10000);
});

describe('test project', () => {
  it('download repo', async () => {
    const fullName = 'India_BCS/hi_hglt_1ti_book';
    const langId = 'hi';
    const resource = getResource(fullName, langId);
    const resourcesPath = './downloads';
    fs.ensureDirSync(resourcesPath);
    try {
      const filePath = await downloadRepo(resource, resourcesPath);
      console.log(filePath);
    } catch (e) {
      console.log(`Error downloading ${fullName}`, e);
    }
  },10000);

  it('verify', async () => {
    const projectsPath = path.join(HOME_DIR, `translationCore/projects`);
    const projects = fs.readdirSync(projectsPath);
    for (const project of projects) {
      const projectPath = path.join(projectsPath, project);
      if (fs.lstatSync(projectPath).isDirectory()) {
        const [langId, projectId, bookId] = project.split('_');
        if (bookId) {
          const projectPath = path.join(projectsPath, project);
          const tools = ['translationNotes', 'translationWords'];
          for (const tool of tools) {
            const indexSubPath = '.apps/translationCore/index/' + tool + '/' + bookId;
            const indexPath_ = path.join(projectPath, indexSubPath);
            let totalChecks = 0;
            let completedChecks = 0;
            const files = fs.readdirSync(indexPath_).filter(item => path.extname(item) === '.json');
            // console.log(files);
            let percentCompleted;

            for (const file of files) {
              const checks = fs.readJsonSync(path.join(indexPath_, file));
              for (const check of checks) {
                totalChecks++;
                completedChecks += (check.selections || check.nothingToSelect) ? 1 : 0;
              }
            }
            if (totalChecks === 0) {
              percentCompleted = 0;
            } else {
              percentCompleted = completedChecks / totalChecks;
            }
            console.log(project + '-' + tool + ': ' + totalChecks + ' totalChecks, ' + completedChecks + 'completedChecks, ' + Math.round(100 * percentCompleted) + '% completed');
          }
        }
      }
    }
  });
});

describe('test API', () => {
  it('test Updater', async () => {

    const sourceContentUpdater = new Updater();
    const localResourceList = getLocalResourceList();
    await sourceContentUpdater.getLatestResources(localResourceList)
      .then(async (updatedLanguages) => {
        // console.log(sourceContentUpdater.updatedCatalogResources);
        await sourceContentUpdater.downloadResources(['ru'], './temp');
        console.log(updatedLanguages);
      })
      .catch((err) => {
        console.error('Local Resource List:', err);
      });
  }, 60000);
});

describe('apiHelpers searching for books', () => {
  const outputFolder = './tc_repos';
  const bookIds = ['rut', 'jon', 'est', 'ezr', 'neh', 'oba', 'luk', 'eph', '1ti', '2ti', 'tit', 'jas', '1jn', '2jn', '3jn'];

  for (const book of bookIds) {
    it(`find tC repos for ${book}`, async () => {
      const resourceId = book;
      console.log(`searching for book ${resourceId}`);
      fs.ensureDirSync(outputFolder);
      const searchUrl = `https://git.door43.org/api/v1/repos/search?q=_${resourceId}_book&sort=updated&order=desc&limit=50`;
      const repos = await apiHelpers.doMultipartQuery(searchUrl);
      console.log(`Search Found ${repos.length} total items`);
      const langRepos = {};
      for (const repo of repos) {
        const [languageId] = repo.name.split('_');
        if (!langRepos[languageId]) {
          langRepos[languageId] = [];
        }
        langRepos[languageId].push(repo);
      }
      const outputFile = path.join(outputFolder, `./${resourceId}-repos.json`);
      fs.outputJsonSync(outputFile, langRepos);
    }, 50000);
  }

  it(`find tC repos for language`, async () => {
    const langList = {};
    const orgList = {};
    const files = fs.readdirSync(outputFolder).filter(item => path.extname(item) === '.json');
    for (const file of files) {
      const [bookId] = file.split('-');
      const filePath = path.join(outputFolder, file);
      const data = fs.readJsonSync(filePath);
      // console.log(data);
      const langs = Object.keys(data);
      for (const langId of langs) {
        if (!langList[langId]) {
          langList[langId] = [];
        }
        if (!orgList[langId]) {
          orgList[langId] = {};
        }
        const newList = langList[langId].concat(data[langId]);
        for (const item of data[langId]) {
          const org = item.owner.login;
          if (!orgList[langId][org]) {
            orgList[langId][org] = 0;
          }
          orgList[langId][org]++;
        }
        langList[langId] = newList;
      }
    }
    const dataFolder = path.join(outputFolder, 'orgs');
    fs.outputJsonSync(path.join(dataFolder, `$orgs.json`), orgList);
    fs.outputJsonSync(path.join(dataFolder, 'langRepos.json'), langList);
  });
});

describe('apiHelpers.getCatalogCN', () => {
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
    writeCsv('./CatalogCN-D43.tsv', csvLines);

    csvLines = [];
    for (const org of orgList) {
      getOrgItems(orgs, org, csvLines);
    }
    console.log(`Catalog Next flattened has ${csvLines.length} total items`);
    writeCsv('./CatalogCN.tsv', csvLines);
  });
}, 10000);

//
// helpers
//

function addCsvItem(list, org, repo, subject, item) {
  const itemJson = JSON.stringify(item).replace('\t','\\t');
  list.push({org, repo, subject, resource: itemJson});
  // list.push(`${org}\t${repo}\t${subject}\t${itemJson}`);
}

function addCsvItem2(list, org, repo, subject, item, category) {
  const itemJson = JSON.stringify(item).replace('\t','\\t');
  list.push({category, org, repo, subject, resource: itemJson});
  // list.push(`${org}\t${repo}\t${subject}\t${itemJson}`);
}

function writeCsv(filename, list) {
  const csvLines = [];
  for (const item of list) {
    const itemJson = JSON.stringify(item.resource).replace('\t', '\\t');
    csvLines.push(`${item.org}\t${item.repo}\t${item.subject}\t${itemJson}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n') + '\n', 'utf8');
}

function writeCsv2(filename, list) {
  const csvLines = [];
  for (const item of list) {
    const itemJson = JSON.stringify(item.resource).replace('\t', '\\t');
    csvLines.push(`${item.category}\t${item.org}\t${item.repo}\t${item.subject}\t${itemJson}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n') + '\n', 'utf8');
}

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
      .filter(file => file !== '.DS_Store');
  } else {
    console.warn(`no such file or directory, ${path}`);
  }

  return cleanDirectories;
};

export const getLocalResourceList = () => {
  try {
    if (!fs.existsSync(USER_RESOURCES_PATH)) {
      fs.ensureDirSync(USER_RESOURCES_PATH);
    }

    const localResourceList = [];
    const resourceLanguages = fs.readdirSync(USER_RESOURCES_PATH)
      .filter(file => path.extname(file) !== '.json' && file !== '.DS_Store');

    for (let i = 0; i < resourceLanguages.length; i++) {
      const languageId = resourceLanguages[i];
      const biblesPath = path.join(USER_RESOURCES_PATH, languageId, 'bibles');
      const tHelpsPath = path.join(USER_RESOURCES_PATH, languageId, TRANSLATION_HELPS);
      const bibleIds = cleanReaddirSync(biblesPath);
      const tHelpsResources = cleanReaddirSync(tHelpsPath);

      bibleIds.forEach(bibleId => {
        const bibleIdPath = path.join(biblesPath, bibleId);
        const bibleLatestVersion = getLatestVersion(bibleIdPath);

        if (bibleLatestVersion) {
          const pathToBibleManifestFile = path.join(bibleLatestVersion, 'manifest.json');

          if (fs.existsSync(pathToBibleManifestFile)) {
            const resourceManifest = fs.readJsonSync(pathToBibleManifestFile);
            const localResource = {
              languageId: languageId,
              resourceId: bibleId,
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

      tHelpsResources.forEach(tHelpsId => {
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
 * @returns {string} the full path to the latest version directory.
 */
function getLatestVersion(dir) {
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
 * @returns {string[]}
 */
function listVersions(dir) {
  if (fs.pathExistsSync(dir)) {
    const versionedDirs = fs.readdirSync(dir).filter(file => fs.lstatSync(path.join(dir, file)).isDirectory() &&
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
function compareVersions(a, b) {
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

function getResource(fullName, langId) {
  const outputFolder = './tc_repos';
  const dataFolder = path.join(outputFolder, 'orgs');
  const repos = fs.readJsonSync(path.join(dataFolder, 'langRepos.json'));
  const langRepos = repos && repos[langId];
  if (langRepos) {
    for (const repo of langRepos) {
      if (repo.full_name === fullName) {
        return repo;
      }
    }
  }
  return null;
}

/**
 * download repo
 * @param {Object} resource
 * @param {string} resourcesPath
 * @return {Promise<String>}
 */
async function downloadRepo(resource, resourcesPath) {
  let zipFilePath;
  let importPath;
  let downloadComplete = false;
  const importsPath = path.join(resourcesPath, 'imports');
  let downloadUrl;

  try {
    const zipFileName = resource.name + '.zip';
    zipFilePath = path.join(importsPath, zipFileName);
    fs.ensureDirSync(importsPath);
    downloadUrl = resource.html_url + '/archive/master.zip';
    console.log('Downloading: ' + downloadUrl);
    const results = await download(downloadUrl, zipFilePath);
    if (results.status === 200) {
      downloadComplete = true;
    } else {
      const message = `Download ${resource.downloadUrl} error, status: ${results.status}`;
      console.log(message);
      throw message;
    }
  } catch (err) {
    throw Error('UNABLE_TO_DOWNLOAD_RESOURCES', err);
  }
  try {
    console.log('Unzipping: ' + resource.downloadUrl);
    importPath = await unzipResource(resource, zipFilePath, resourcesPath);
  } catch (err) {
    throw Error('UNABLE_TO_UNZIP_RESOURCES', err);
  }
  const importSubdirPath = getSubdirOfUnzippedResource(importPath);
  return importSubdirPath;
}
