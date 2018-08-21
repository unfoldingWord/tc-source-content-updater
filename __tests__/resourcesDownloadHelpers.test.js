import fs from 'fs-extra';
import rimraf from 'rimraf';
// helpers
import * as resourcesDownloadHelpers from '../src/helpers/resourcesDownloadHelpers';
import * as parseHelpers from '../src/helpers/parseHelpers';

jest.mock('../src/helpers/downloadHelpers');
jest.mock('../src/helpers/zipFileHelpers');

const catalog = require('../__tests__/fixtures/api.door43.org/v3/subjects/pivoted.json');
describe('Tests for resourcesDownloadHelpers', function() {
  const resources = parseHelpers.getLatestResources(catalog, []);
  const resourcesPath = '/tmp/resources'; // a mocked resources directory

  beforeEach(() => {
    fs.__resetMockFS();
  });

  it('Test resourcesDownloadHelpers.downloadResources() for null', async () => {
    // given
    const languageList = null;
    const expectedError = 'Language list is empty';

    // then
    await expect(resourcesDownloadHelpers.downloadResources(languageList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.downloadResources() for empty list', async () => {
    // given
    const languageList = [];
    const expectedError = 'Language list is empty';

    // then
    await expect(resourcesDownloadHelpers.downloadResources(languageList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.downloadResources() for "hi" should download, process and deploy all resources', async () => {
    const languageList = ['hi'];
    const expectedResourcesDownloaded = 5;
    await resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources)
      .then(resourcesDownloaded => {
        expect(resourcesDownloaded.length).toEqual(expectedResourcesDownloaded);
      })
      .catch(err => {
        expect(err).not.toBeTruthy(); // shouldn't get here
      });
  });

  it('Test resourcesDownloadHelpers.downloadResources() for "grc" should download, process and deploy the Bible and the tW Group Data', async () => {
    const languageList = ['grc'];
    const expectedResourcesDownloaded = 1;
    await resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources)
      .then(resourcesDownloaded => {
        expect(resourcesDownloaded.length).toEqual(expectedResourcesDownloaded);
      })
      .catch(err => {
        expect(err).not.toBeTruthy(); // shouldn't get here
      });
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for populated language should download zip files', async () => {
    const languageList = ['hi'];
    const expectedResourcesDownloaded = 5;
    await resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources)
      .then(resourcesDownloaded => {
        expect(resourcesDownloaded.length).toEqual(expectedResourcesDownloaded);
      })
      .catch(err => {
        expect(err).not.toBeTruthy(); // shouldn't get here
      });
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for populated language list with no resources should pass', async () => {
    // given
    const languageList = ['en', 'hi'];
    const resources = [];
    const expectedResolve = [];

    // then
    await expect(resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources)).resolves.toEqual(expectedResolve);
  });
});
