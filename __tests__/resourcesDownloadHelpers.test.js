import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
// helpers
import * as resourcesDownloadHelpers from '../src/helpers/resourcesDownloadHelpers';
import * as parseHelpers from '../src/helpers/parseHelpers';
// constants
import * as errors from '../src/resources/errors';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
const catalog = require('./fixtures/api.door43.org/v3/subjects/pivoted.json');

describe('Tests for resourcesDownloadHelpers.downloadResources()', function() {
  const resources = parseHelpers.getLatestResources(catalog, []);
  const resourcesPath = path.join(ospath.home(), 'translationCore/resources'); // a mocked resources directory

  beforeEach(() => {
    fs.__resetMockFS();
    fs.ensureDirSync(resourcesPath);
  });

  it('Test resourcesDownloadHelpers.downloadResources() for null', async () => {
    const languageList = null;
    const expectedError = errors.LANGUAGE_LIST_EMPTY;
    expect(resourcesDownloadHelpers.downloadResources(languageList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.downloadResources() for empty list', async () => {
    const languageList = [];
    const expectedError = errors.LANGUAGE_LIST_EMPTY;
    expect(resourcesDownloadHelpers.downloadResources(languageList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.downloadResources() for "hi" should download, process and deploy all resources', async () => {
    const languageList = ['hi'];
    const expectedLength = 3;
    expect(resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources)).resolves.toHaveLength(expectedLength);
  });

  it('Test resourcesDownloadHelpers.downloadResources() for "el-x-koine" should download, process and deploy the Bible and the tW Group Data', async () => {
    const languageList = ['el-x-koine'];
    const expectedLength = 1;
    expect(resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources)).resolves.toHaveLength(expectedLength);
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for populated language list with no resources should pass', async () => {
    const languageList = ['en', 'hi'];
    const resources = [];
    const expectedResolve = [];
    expect(resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources)).resolves.toEqual(expectedResolve);
  });
});

describe('Tests for resourcesDownloadHelpers.downloadAndProcessResource()', () => {
  const resourcesPath = path.join(ospath.home(), 'translationCore/resources');

  it('Test resourcesDownloadHelpers.downloadAndProcessResource() for CEB ULB', () => {
    const resource = {
      languageId: 'ceb',
      resourceId: 'ulb',
      remoteModifiedTime: '0001-01-01T00:00:00+00:00',
      downloadUrl: 'https://cdn.door43.org/ceb/ulb/v4.2/ulb.zip',
      version: '4.2',
      subject: 'Bible',
      catalogEntry: {
        subject: {},
        resource: {},
        format: {}
      }
    };
    expect(resourcesDownloadHelpers.downloadAndProcessResource(resource, resourcesPath)).resolves.toEqual(resource);
  });

  it('Test resourcesDownloadHelpers.downloadAndProcessResource() for GRC UGNT', () => {
    const resource = {
      languageId: 'el-x-koine',
      resourceId: 'ugnt',
      remoteModifiedTime: '0001-01-01T00:00:00+00:00',
      downloadUrl: 'https://cdn.door43.org/el-x-koine/ugnt/v0.2/ugnt.zip',
      version: '0.2',
      subject: 'Bible',
      catalogEntry: {
        subject: {},
        resource: {},
        format: {}
      }
    };
    expect(resourcesDownloadHelpers.downloadAndProcessResource(resource, resourcesPath)).resolves.toEqual(resource);
  });
});
