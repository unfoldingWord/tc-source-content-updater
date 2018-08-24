import fs from 'fs-extra';
// helpers
import * as resourcesDownloadHelpers from '../src/helpers/resourcesDownloadHelpers';
import * as parseHelpers from '../src/helpers/parseHelpers';
import * as errors from '../src/resources/errors';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
const catalog = require('./fixtures/api.door43.org/v3/subjects/pivoted.json');

describe('Tests for resourcesDownloadHelpers.downloadResources()', function() {
  const resources = parseHelpers.getLatestResources(catalog, []);
  const resourcesPath = '/tmp/resources'; // a mocked resources directory

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

  it('Test resourcesDownloadHelpers.downloadResources() for "grc" should download, process and deploy the Bible and the tW Group Data', async () => {
    const languageList = ['grc'];
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

describe('Tests for resourcesDownloadHelpers.downloadResource()', () => {
  it('Test resourcesDownloadHelpers.downloadResource() for CEB ULB', () => {
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
    const resourcesPath = '/tmp/resources';
    expect(resourcesDownloadHelpers.downloadResource(resource, resourcesPath)).resolves.toEqual(resource);
  });
});
