// these are integration tests used for development, these are all normally skipped.
// these are for validating switch to Catalog Next APIs

import fs from 'fs-extra';
import path from 'path-extra';
import os from 'os';
import _ from 'lodash';
// import nock from 'nock';
import * as apiHelpers from '../src/helpers/apiHelpers';
import Updater, {SORT, STAGE, SUBJECT} from '../src';
import {
  addCsvItem,
  addCsvItem2,
  getLocalResourceList,
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

// // disable nock failed
// nock.restore();
// nock.cleanAll();

describe('test API', () => {
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
    const org = 'Door43-Catalog';
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

  it('test search & download CatalogNext', async () => {
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
    const org = 'Door43-Catalog';
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
    const resourcesPath = './temp/updates';
    // const resourcesPath = USER_RESOURCES;
    const sourceContentUpdater = new Updater();
    const localResourceList = getLocalResourceList(resourcesPath);
    const initialResourceList = saveResources(resourcesPath, localResourceList, 'initial');
    const updatedLanguages = await sourceContentUpdater.getLatestResources(localResourceList);
    saveResources(resourcesPath, updatedLanguages, 'updated');
    // console.log(sourceContentUpdater.updatedCatalogResources);
    const resourceStatus = _.cloneDeep(localResourceList);
    const langsToUpdate = ['es-419', 'en', 'el-x-koine', 'hi'];
    const remoteResources = sourceContentUpdater.remoteCatalog.filter(item => langsToUpdate.includes(item.language));
    const updatedRemoteResources = sourceContentUpdater.updatedCatalogResources.filter(item => langsToUpdate.includes(item.languageId));
    // const langsToUpdate = ['en', 'el-x-koine', 'es-419', 'hbo', 'ru'];
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
      await sourceContentUpdater.downloadResources(langsToUpdate, resourcesPath);
    } catch (e) {
      downloadErrors = e.toString();
    }
    // console.log(updatedLanguages);
    const localResourceListAfter = getLocalResourceList(resourcesPath);
    const finalResourceList = saveResources(resourcesPath, localResourceListAfter, 'final');
    const sourceContentUpdater2 = new Updater();
    const newUpdatedLanguages = await sourceContentUpdater2.getLatestResources(localResourceListAfter);
    for (const langId of langsToUpdate) {
      const match = newUpdatedLanguages.find(item => (item.languageId === langId));
      if (match) {
        console.error(`didn't get updated: ${match.languageId}`);
      }
      expect(match).toBeFalsy();
    }
    expect(downloadErrors).toBeFalsy();
    console.log('stuff');
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
    const res = await apiHelpers.getCatalogOld();
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
      // const parts = url.split('/');
      const org = item.owner;
      const item_ = { org, repo, subject, resourceId, languageId };
      const itemJson = JSON.stringify(item_);
      if (itemJson.toLowerCase().indexOf('obs') >= 0) {
        console.log(`found OBS in ${org}/${repo} - ${subject}: ${itemJson}`);
      }
      const pos = csvLines.findIndex((line) => ((line.repo === repo) && (line.org === org)));
      if (pos >= 0) {
        const line = csvLines[pos];
        if (line.matched) {
          console.log(`dupe in catalog: ${org}/${repo} - ${subject}: ${itemJson}`);
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
        addCsvItem2(csvLines, org, repo, subject, item, cnCatalog, url);
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
