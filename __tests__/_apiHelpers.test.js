// this is just a development playbox
// for validating switch to Catalog Next APIs

import os from 'os';
import _ from 'lodash';
// import nock from 'nock';
import * as apiHelpers from '../src/helpers/apiHelpers';
import Updater from '../src';
import {
  addCsvItem,
  addCsvItem2,
  getLocalResourceList,
  getOrgItems,
  saveResources,
  writeCsv,
  writeCsv2,
} from './_apiHelpers';

// require('os').homedir()

jest.unmock('fs-extra');
jest.unmock('../src/helpers/downloadHelpers');
jest.unmock('../src/helpers/zipFileHelpers');

// const searchForLangAndBook = `https://git.door43.org/api/v1/repos/search?q=hi%5C_%25%5C_act%5C_book&sort=updated&order=desc&limit=30`;

// // disable nock failed
// nock.restore();
// nock.cleanAll();

describe('test API', () => {
  it('test Updater', async () => {
    const resourcesPath = './temp/updates';
    const sourceContentUpdater = new Updater();
    const localResourceList = getLocalResourceList(resourcesPath);
    const initialResourceList = saveResources(resourcesPath, localResourceList, 'initial');
    const updatedLanguages = await sourceContentUpdater.getLatestResources(localResourceList);
    saveResources(resourcesPath, updatedLanguages, 'updated');
    // console.log(sourceContentUpdater.updatedCatalogResources);
    const resourceStatus = _.cloneDeep(localResourceList);
    const langsToUpdate = ['en', 'el-x-koine', 'es-419', 'hbo', 'ru'];
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
    await sourceContentUpdater.downloadResources(langsToUpdate, resourcesPath);
    // console.log(updatedLanguages);
    const localResourceListAfter = getLocalResourceList(resourcesPath);
    const finalResourceList = saveResources(resourcesPath, localResourceListAfter, 'final');
    const sourceContentUpdater2 = new Updater();
    const newUpdatedLanguages = await sourceContentUpdater2.getLatestResources(localResourceListAfter);
    for (const langId of langsToUpdate) {
      const match = newUpdatedLanguages.find(item => (item.languageId === langId));
      if (match) {
        console.error(`didn't get updated: ${match.fullName}`);
      }
      expect(match).toBeFalsy();
    }
    console.log('stuff');
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
