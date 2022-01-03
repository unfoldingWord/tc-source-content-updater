import Updater from '../src';
import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
// constants
import * as errors from '../src/resources/errors';
import * as parseHelpers from '../src/helpers/parseHelpers';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Updater.downloadResources', () => {
  const updater = new Updater();
  const resourcesPath = path.join(ospath.home(), 'translationCore/resources'); // a mocked resources directory

  beforeEach(() => {
    fs.__resetMockFS();
    fs.ensureDirSync(resourcesPath);
  });

  it('should resolve for hbo', async () => {
    loadMockedResources(updater);
    let languageID = 'hbo';
    const hebrewSubject = updater.remoteCatalog.find(item => (item.language === languageID));
    const resources = await updater.downloadResources([languageID], resourcesPath);
    expect(resources.length).toEqual(1);
    expect(hebrewSubject.languageId).toEqual(resources[0].language);
    expect(hebrewSubject.subject).toEqual(resources[0].subject);
  });

  it('should resolve for el-x-koine', async () => {
    loadMockedResources(updater);
    const resources = await updater.downloadResources(['el-x-koine'], resourcesPath);
    expect(resources.length).toEqual(1);
  });

  it('should fail due to language list empty', async () => {
    loadMockedResources(updater);
    const expectedError = errors.LANGUAGE_LIST_EMPTY;
    expect(updater.downloadResources()).rejects.toEqual(expectedError);
  });

  it('should fail due to resources path not given', async () => {
    loadMockedResources(updater);
    const languageIds = ['en'];
    const expectedError = errors.RESOURCES_PATH_NOT_GIVEN;
    expect(updater.downloadResources(languageIds)).rejects.toEqual(expectedError);
  });

  it('should resolve for multiple languages being downloaded', async () => {
    loadMockedResources(updater);
    const languageList = ['el-x-koine', 'en', 'hi', 'ceb'];
    const resources = await updater.downloadResources(languageList, resourcesPath);
    expect(resources.length).toEqual(10);
    expect(fs.readdirSync(resourcesPath)).toContain(...languageList);
  });

  it('should properly parse a special quote, character', async () => {
    loadMockedResources(updater);
    fs.__loadDirIntoMockFs(path.join(__dirname, 'fixtures'), path.join(__dirname, 'fixtures'));
    await updater.downloadResources(['en'], resourcesPath, [
      fs.readJsonSync(path.join(__dirname, 'fixtures/en_ult_resource.json'))
    ]);
    const ultPath = path.join(resourcesPath, 'en', 'bibles', 'ult', 'v1', '2ti', '3.json');
    expect(fs.existsSync(ultPath)).toEqual(true);
    const data = fs.readJsonSync(ultPath);
    expect(data['9']['verseObjects'][0].content).toEqual('ἀλλ’');
  });

  it('should reject for a download url that does not exist', async () => {
    loadMockedResources(updater);
    const prevResources = [{
      languageId: 'el-x-koine',
      resourceId: 'ugnt',
      remoteModifiedTime: '2018-08-02T17:46:25+00:00',
      downloadUrl: 'a/url/that/should/fail',
      version: '0.2',
      subject: 'Greek_New_Testament',
      catalogEntry: {}
    }];
    await updater.downloadResources(['el-x-koine'], resourcesPath, prevResources).catch(err => {
      expect(err).toBeTruthy();
    });
  });

  it('should reject for a download url that does not exist #2', async () => {
    loadMockedResources(updater);
    const prevResources = [{
      languageId: 'en',
      resourceId: 'tw',
      remoteModifiedTime: '2017-11-29T20:55:17+00:00',
      downloadUrl: 'a/url/that/should/fail',
      version: '8',
      subject: 'Translation_Words',
      catalogEntry: {}
    },
      {
        languageId: 'en',
        resourceId: 'udb',
        remoteModifiedTime: '2017-12-07T23:47:59+00:00',
        downloadUrl: 'https://cdn.door43.org/en/udb/v12/udb.zip',
        version: '12',
        subject: 'Bible',
        catalogEntry: {}
      },
      {
        languageId: 'en',
        resourceId: 'ulb',
        remoteModifiedTime: '2017-12-07T23:45:40+00:00',
        downloadUrl: 'https://cdn.door43.org/en/ulb/v12/ulb.zip',
        version: '12',
        subject: 'Bible',
        catalogEntry: {}
      },
      {
        languageId: 'en',
        resourceId: 'ta',
        remoteModifiedTime: '2018-08-14T16:49:57+00:00',
        downloadUrl: 'https://cdn.door43.org/en/ta/v9/ta.zip',
        version: '9',
        subject: 'Translation_Academy',
        catalogEntry: {}
      },
      {
        languageId: 'hi',
        resourceId: 'tw',
        remoteModifiedTime: '2018-06-08T19:49:08+00:00',
        downloadUrl: 'https://cdn.door43.org/hi/tw/v8.1/bible.zip',
        version: '8.1',
        subject: 'Translation_Words',
        catalogEntry: {}
      },
      {
        languageId: 'hi',
        resourceId: 'udb',
        remoteModifiedTime: '2018-08-16T19:01:48+00:00',
        downloadUrl: 'a/url/that/should/fail',
        version: '5.1',
        subject: 'Bible',
        catalogEntry: {}
      },
      {
        languageId: 'hi',
        resourceId: 'ulb',
        remoteModifiedTime: '2018-08-01T19:08:11+00:00',
        downloadUrl: 'https://cdn.door43.org/hi/ulb/v5/ulb.zip',
        version: '5',
        subject: 'Bible',
        catalogEntry: {}
      },
      {
        languageId: 'ceb',
        resourceId: 'ulb',
        remoteModifiedTime: '0001-01-01T00:00:00+00:00',
        downloadUrl: 'https://cdn.door43.org/ceb/ulb/v4.2/ulb.zip',
        version: '4.2',
        subject: 'Bible',
        catalogEntry: {}
      },
      {
        languageId: 'ceb',
        resourceId: 'udb',
        remoteModifiedTime: '2018-08-16T18:57:32+00:00',
        downloadUrl: 'https://cdn.door43.org/ceb/udb/v4.1/eph.zip',
        version: '4.1',
        subject: 'Bible',
        catalogEntry: {}
      },
      {
        languageId: 'ceb',
        resourceId: 'tw',
        remoteModifiedTime: '2018-04-27T19:39:52+00:00',
        downloadUrl: 'https://cdn.door43.org/ceb/tw/v6.1/bible.zip',
        version: '6.1',
        subject: 'Translation_Words',
        catalogEntry: {}
      }];
    const languageList = ['en', 'hi', 'ceb'];
    await updater.downloadResources(languageList, resourcesPath, prevResources).catch(err => {
      expect(err).toBeTruthy();
      expect(fs.readdirSync(path.join(resourcesPath, 'en', 'translationHelps', 'translationWords')).length).toBe(0);
      expect(fs.readdirSync(path.join(resourcesPath, 'en', 'bibles', 'ulb')).length).toBeGreaterThan(0);
      expect(fs.readdirSync(path.join(resourcesPath, 'en', 'bibles', 'udb')).length).toBeGreaterThan(0);
      expect(fs.readdirSync(path.join(resourcesPath, 'hi', 'bibles', 'ulb')).length).toBeGreaterThan(0);
      expect(fs.readdirSync(path.join(resourcesPath, 'hi', 'bibles', 'udb')).length).toBe(0);
      expect(fs.readdirSync(path.join(resourcesPath, 'ceb', 'bibles', 'udb')).length).toBeGreaterThan(0);
      expect(fs.readdirSync(path.join(resourcesPath, 'ceb', 'bibles', 'ulb')).length).toBeGreaterThan(0);
    });
  });
});

//
// helpers
//

/**
 * load mocked resources
 * @param {object} updater
 * @return {Array<{languageId: String, localModifiedTime: String, remoteModifiedTime: String}>}
 */
function loadMockedResources(updater) {
  updater.remoteCatalog = fs.__actual.readJsonSync(path.join('./__tests__/fixtures/catalogNext.json'));
  updater.updatedCatalogResources = parseHelpers.getLatestResources(updater.remoteCatalog, []);
  const langlist = parseHelpers.getUpdatedLanguageList(updater.updatedCatalogResources);
  return langlist;
}
