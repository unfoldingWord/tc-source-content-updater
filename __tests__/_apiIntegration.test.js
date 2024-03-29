// these are integration tests used for development, these are all normally skipped.
// these are for validating switch to Catalog Next APIs

import fs from 'fs-extra';
import path from 'path-extra';
import os from 'os';
import _ from 'lodash';
import rimraf from 'rimraf';
import * as apiHelpers from '../src/helpers/apiHelpers';
import Updater, {SUBJECT} from '../src';
import {
  addCsvItem,
  addCsvItem2,
  getOrgItems,
  saveResources,
  sortStringObjects,
  writeCsv,
  writeCsv2,
  writeToTsv,
} from './_apiIntegrationHelpers';

// require('os').homedir()

jest.unmock('fs-extra');
jest.unmock('../src/helpers/downloadHelpers');
jest.unmock('../src/helpers/zipFileHelpers');

const HOME_DIR = os.homedir();
const USER_RESOURCES = path.join(HOME_DIR, `translationCore/resources`);
export const JSON_OPTS = {spaces: 2};

describe.skip('test API', () => {
  it('test TWL', async () => {
    const filterByOwner = null; // ['Door43-Catalog']; // set to null to do all owners
    const langsToUpdate = ['en', 'el-x-koine', 'es-419', 'hbo', 'ru']; // set to null to update all
    const allAlignedBibles = false; // if true then also download all aligned bibles
    const resourcesPath = './temp/updates';
    rimraf.sync(path.join(resourcesPath, 'imports'), fs);
    const sourceContentUpdater = new Updater();
    const localResourceList = apiHelpers.getLocalResourceList(resourcesPath);
    const initialResourceList = saveResources(resourcesPath, localResourceList, 'initial');
    const updatedLanguages = await sourceContentUpdater.getLatestResources(localResourceList, filterByOwner);
    saveResources(resourcesPath, updatedLanguages, 'updated');
    const resourceStatus = _.cloneDeep(localResourceList);
    let remoteResources = sourceContentUpdater.remoteCatalog;
    let updatedRemoteResources = sourceContentUpdater.updatedCatalogResources;
    if (langsToUpdate) {
      remoteResources = sourceContentUpdater.remoteCatalog.filter(item => langsToUpdate.includes(item.language));
      updatedRemoteResources = sourceContentUpdater.updatedCatalogResources.filter(item => langsToUpdate.includes(item.languageId));
    }
     for (const langId of langsToUpdate) {
      if (updatedLanguages.find(item => (item.languageId === langId))) {
        for (const remote of sourceContentUpdater.updatedCatalogResources) {
          if (remote.languageId === langId) {
            const match = resourceStatus.find(local => (local.languageId === remote.languageId && local.resourceId === remote.resourceId));
            if (match) {
              match.remoteModifiedTime = remote.remoteModifiedTime;
            } else {
              resourceStatus.push({
                languageId: remote.languageId,
                resourceId: remote.resourceId,
                version: remote.version,
                remoteModifiedTime: remote.remoteModifiedTime,
              });
            }
            console.log('stuff');
          }
        }
      }
    }
    let downloadErrors = null;
    try {
      await sourceContentUpdater.downloadResources(langsToUpdate, resourcesPath, sourceContentUpdater.updatedCatalogResources, allAlignedBibles);
    } catch (e) {
      downloadErrors = e.toString();
    }
    const localResourceListAfter = apiHelpers.getLocalResourceList(resourcesPath);
    const finalResourceList = saveResources(resourcesPath, localResourceListAfter, 'final');
    const sourceContentUpdater2 = new Updater();
    const newUpdatedLanguages = await sourceContentUpdater2.getLatestResources(localResourceListAfter, filterByOwner);
    const failedUpdates = [];
    for (const langId of langsToUpdate) {
      const match = newUpdatedLanguages.find(item => (item.languageId === langId));
      if (match) {
        console.error(`Language didn't get updated: ${match.languageId}`);
        for (const resource of match.resources) {
          const description = `${resource.owner}/${resource.languageId}_${resource.resourceId}`;
          console.error(`Missing: ${description}`);
          failedUpdates.push(description);
        }
      }
    }
    if (downloadErrors) {
      console.error(`Download errors: ${downloadErrors}`);
    }
    expect(failedUpdates.length).toEqual(0);
    expect(downloadErrors).toBeFalsy();
    console.log('Test finally Done');
  }, 6000000);

  it('test searchCatalogNext', async () => {
    const sourceContentUpdater = new Updater();
    const searchParams = {
      subject: SUBJECT.ALL_TC_RESOURCES,
      // owner: 'unfoldingWord',
      languageId: 'en',
      // sort: SORT.LANGUAGE_ID,

      // ========================
      // less common params:
      // ========================

      limit: 10000,
      // partialMatch: true,
      // stage: STAGE.PROD,
      // checkingLevel: 3,
    };
    const items = await sourceContentUpdater.searchCatalogNext(searchParams);
    expect(Array.isArray(items)).toBeTruthy();
    console.log(`Search returned ${items.length} total items`);
    const repoLines = [];
    const owner = 'Door43-Catalog';
    for (const item of items) {
      const line = {
        full_name: item.full_name,
        clone_url: item.repo.clone_url,
        subject: item.subject,
        stage: item.stage,
        branch_or_tag_name: item.branch_or_tag_name,
        title: item.title,
        version: item.version,
      };
      repoLines.push(line);
    }
    console.log(`search flattened has ${repoLines.length} total items`);
    const repoFormat = [
      {
        key: 'full_name',
        text: 'full_name',
      },
      {
        key: 'clone_url',
        text: 'clone_url',
      },
      {
        key: `subject`,
        text: 'subject',
      },
      {
        key: `stage`,
        text: 'stage',
      },
      {
        key: `version`,
        text: 'version',
      },
      {
        key: `title`,
        text: 'title',
      },
    ];
    const outputFolder = './temp';
    const outputFile = 'CatalogNew';
    writeToTsv(repoFormat, sortStringObjects(repoLines, 'full_name'), outputFolder, outputFile + '.tsv');
    fs.outputJsonSync(path.join(outputFolder, outputFile + '.json'), items, JSON_OPTS);
  }, 60000);

  it.skip('test search & download CatalogNext', async () => {
    const sourceContentUpdater = new Updater();
    const searchParams = {
      subject: SUBJECT.ALL_TC_RESOURCES,
      owner: 'Es-419_gl',
      languageId: 'es-419',
      // sort: SORT.LANGUAGE_ID,

      // ========================
      // less common params:
      // ========================

      limit: 10000,
      // partialMatch: true,
      // stage: STAGE.PROD,
      // checkingLevel: 3,
    };
    const items = await sourceContentUpdater.searchCatalogNext(searchParams);
    expect(Array.isArray(items)).toBeTruthy();
    console.log(`Search returned ${items.length} total items`);
    const repoLines = [];
    const owner = 'Door43-Catalog';
    for (const item of items) {
      const line = {
        full_name: item.full_name,
        clone_url: item.repo.clone_url,
        subject: item.subject,
        stage: item.stage,
        branch_or_tag_name: item.branch_or_tag_name,
        title: item.title,
        version: item.version,
        owner,
      };
      repoLines.push(line);
    }
    console.log(`search flattened has ${repoLines.length} total items`);
    const repoFormat = [
      {
        key: 'full_name',
        text: 'full_name',
      },
      {
        key: 'clone_url',
        text: 'clone_url',
      },
      {
        key: `subject`,
        text: 'subject',
      },
      {
        key: `stage`,
        text: 'stage',
      },
      {
        key: `version`,
        text: 'version',
      },
      {
        key: `title`,
        text: 'title',
      },
    ];
    const outputFolder = './temp';
    const outputFile = 'CatalogNew';
    writeToTsv(repoFormat, sortStringObjects(repoLines, 'full_name'), outputFolder, outputFile + '.tsv');
    fs.outputJsonSync(path.join(outputFolder, outputFile + '.json'), items, JSON_OPTS);

    const resourcesPath = './temp/updates';
    let results;
    try {
      results = await sourceContentUpdater.downloadAllResources(resourcesPath, items);
    } catch (e) {
      results = null;
      console.error('error downloading', e);
    }
    expect(results).toBeTruthy();
    expect(results.length).toEqual(items.length);
    const errors = sourceContentUpdater.getLatestDownloadErrorsStr();
    expect(errors).toBeFalsy();
  }, 600000);

  it('test Updater', async () => {
    const filterByOwner = ['Door43-Catalog']; // set to null to do all owners
    const langsToUpdate = ['en', 'el-x-koine', 'hi', 'hbo'];
    const allAlignedBibles = true; // if true then also download all aligned bibles
    const resourcesPath = './temp/updates';
    // const resourcesPath = USER_RESOURCES;
    const sourceContentUpdater = new Updater();
    const localResourceList = apiHelpers.getLocalResourceList(resourcesPath);
    const initialResourceList = saveResources(resourcesPath, localResourceList, 'initial');
    const updatedLanguages = await sourceContentUpdater.getLatestResources(localResourceList, filterByOwner);
    saveResources(resourcesPath, updatedLanguages, 'updated');
    const resourceStatus = _.cloneDeep(localResourceList);
    let remoteResources = sourceContentUpdater.remoteCatalog;
    let updatedRemoteResources = sourceContentUpdater.updatedCatalogResources;
    if (langsToUpdate) {
      remoteResources = sourceContentUpdater.remoteCatalog.filter(item => langsToUpdate.includes(item.language));
      updatedRemoteResources = sourceContentUpdater.updatedCatalogResources.filter(item => langsToUpdate.includes(item.languageId));
    }
    for (const langId of langsToUpdate) {
      if (updatedLanguages.find(item => (item.languageId === langId))) {
        for (const remote of sourceContentUpdater.updatedCatalogResources) {
          if (remote.languageId === langId) {
            const match = resourceStatus.find(local => (local.languageId === remote.languageId && local.resourceId === remote.resourceId));
            if (match) {
              match.remoteModifiedTime = remote.remoteModifiedTime;
            } else {
              resourceStatus.push({
                languageId: remote.languageId,
                resourceId: remote.resourceId,
                version: remote.version,
                remoteModifiedTime: remote.remoteModifiedTime,
              });
            }
            console.log('stuff');
          }
        }
      }
    }
    let downloadErrors = null;
    try {
      await sourceContentUpdater.downloadResources(langsToUpdate, resourcesPath, sourceContentUpdater.updatedCatalogResources, allAlignedBibles);
    } catch (e) {
      downloadErrors = e.toString();
    }
    const localResourceListAfter = apiHelpers.getLocalResourceList(resourcesPath);
    const finalResourceList = saveResources(resourcesPath, localResourceListAfter, 'final');
    const sourceContentUpdater2 = new Updater();
    const newUpdatedLanguages = await sourceContentUpdater2.getLatestResources(localResourceListAfter, filterByOwner);
    const failedUpdates = [];
    for (const langId of langsToUpdate) {
      const match = newUpdatedLanguages.find(item => (item.languageId === langId));
      if (match) {
        console.error(`Language didn't get updated: ${match.languageId}`);
        for (const resource of match.resources) {
          const description = `${resource.owner}/${resource.languageId}_${resource.resourceId}`;
          console.error(`Missing: ${description}`);
          failedUpdates.push(description);
        }
      }
    }
    if (downloadErrors) {
      console.error(`Download errors: ${downloadErrors}`);
    }
    expect(failedUpdates.length).toEqual(0);
    expect(downloadErrors).toBeFalsy();
    console.log('Test finally Done');
  }, 6000000);
});

describe.skip('apiHelpers.getCatalogOld', () => {
  it('should get the resulting catalog', () => {
    return apiHelpers.getCatalogOld().then((res) => {
      expect(res).toMatchObject({
        catalogs: expect.any(Array),
        subjects: expect.any(Array),
      });
      const items = res && res.subjects;
      console.log(`D43 Catalog returned ${items.length} total items`);
      const csvLines = [];
      const owner = 'Door43-Catalog';
      for (const item of items) {
        const language = item.language;
        for (const resource of item.resources) {
          const resId = resource.identifier;
          const subject = resource.subject;
          const repo = `${language}_${resId}`;
          addCsvItem(csvLines, owner, repo, subject, resource);
        }
      }
      console.log(`D43 Catalog flattened has ${csvLines.length} total items`);
      writeCsv('./temp/CatalogOld.tsv', csvLines);
    });
  });
});

describe.skip('apiHelpers compare pivoted.json with CN', () => {
  it('should make a merged CSV', async () => {
    const res = await apiHelpers.getCatalogOld();
    expect(res).toMatchObject({
      catalogs: expect.any(Array),
      subjects: expect.any(Array),
    });
    const items = res && res.subjects;
    console.log(`D43 Catalog returned ${items.length} total items`);
    const csvLines = [];
    const owner = 'Door43-Catalog';
    const oldCatalog = 'Old';
    for (const item of items) {
      const language = item.language;
      for (const resource of item.resources) {
        const resId = resource.identifier;
        const subject = resource.subject;
        const repo = `${language}_${resId}`;
        addCsvItem2(csvLines, owner, repo, subject, resource, oldCatalog);
      }
    }
    console.log(`D43 Catalog flattened has ${csvLines.length} total items`);
    writeCsv('./temp/CatalogOld.tsv', csvLines);

    const data = await apiHelpers.getOldCatalogReleases();
    console.log(`Catalog Next Found ${data.length} total items`);
    expect(data.length).toBeTruthy();
    const cnCatalog = 'CN';
    const cnCatalogCombined = 'CN+Old';
    for (const item of data) {
      const subject = item.subject;
      const resourceId = item.identifier;
      const languageId = item.language;
      const repo = item.repo;
      const url = item.formats && item.formats[0] && item.formats[0].url;
      const owner = item.owner;
      const item_ = {owner, repo, subject, resourceId, languageId};
      const itemJson = JSON.stringify(item_);
      if (itemJson.toLowerCase().indexOf('obs') >= 0) {
        console.log(`found OBS in ${owner}/${repo} - ${subject}: ${itemJson}`);
      }
      const pos = csvLines.findIndex((line) => ((line.repo === repo) && (line.owner === owner)));
      if (pos >= 0) {
        const line = csvLines[pos];
        if (line.matched) {
          console.log(`dupe in catalog: ${owner}/${repo} - ${subject}: ${itemJson}`);
        } else {
          line.matched = true;
        }
        line.subject = subject;
        line.url = url;
        if (line.category === oldCatalog) {
          line.category = cnCatalogCombined;
        } else {
          console.log(JSON.stringify(line));
        }
      } else {
        addCsvItem2(csvLines, owner, repo, subject, item, cnCatalog, url);
      }
    }

    writeCsv2('./temp/Catalog-CN-and-Old.tsv', csvLines);
    console.log('done');
  }, 10000);
});

describe.skip('apiHelpers.getCatalogCN', () => {
  it('should get the CN catalog', async () => {
    const unFilteredSearch = 'https://git.door43.org/api/v1/catalog/search?metadataType=rc&sort=subject&limit=50';
    const data = await apiHelpers.doMultipartQuery(unFilteredSearch);
    console.log(`Catalog Next Found ${data.length} total items`);
    expect(data.length).toBeTruthy();
    const owners = {};
    for (let i = 0, l = data.length; i < l; i++) {
      const item = data[i];
      const owner = item && item.repo && item.repo.owner && item.repo.owner.login || null;
      if (owner) {
        if (!owners[owner]) {
          owners[owner] = [];
        }
        owners[owner].push(item);
      } else {
        console.log(`missing owner in ${JSON.stringify(item)}`);
      }
    }
    const ownersList = Object.keys(owners);
    for (const owner of ownersList) {
      console.log(`${owner} has ${owners[owner].length} items`);
    }

    let csvLines = [];
    const owner = 'Door43-Catalog';
    getOrgItems(owners, owner, csvLines);
    console.log(`D43 Catalog flattened has ${csvLines.length} total items`);
    writeCsv('./temp/CatalogCN-D43.tsv', csvLines);

    csvLines = [];
    for (const owner of ownersList) {
      getOrgItems(owners, owner, csvLines);
    }
    console.log(`Catalog Next flattened has ${csvLines.length} total items`);
    writeCsv('./temp/CatalogCN.tsv', csvLines);
  });
}, 10000);
