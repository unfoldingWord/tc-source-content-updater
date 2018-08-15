jest.unmock('fs-extra');
import tmp from 'tmp';
// helpers
import * as resourcesDownloadHelpers from '../src/helpers/resourcesDownloadHelpers';
import * as parseHelpers from '../src/helpers/parseHelpers';

const catalog = require('./fixtures/catalog');
jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

describe('Tests for resourcesDownloadHelpers', function() {
  const resources = parseHelpers.getLatestResources(catalog, []);
  let resourcesPath = null;

  beforeEach(() => {
    resourcesPath = tmp.dirSync({prefix: 'resources_'});
  });

  afterEach(() => {
    // resourcesPath.removeCallback();
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for null', async () => {
    // given
    const languageList = null;
    const expectedError = 'Language list is empty';

    // then
    await expect(resourcesDownloadHelpers.downloadResources(languageList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for empty list', async () => {
    // given
    const languageList = [];
    const expectedError = 'Language list is empty';

    // then
    await expect(resourcesDownloadHelpers.downloadResources(languageList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for populated language should download zip files', async () => {
    const languageList = ['hi'];
    const expectedResourcesDownloaded = 4;
    console.log(catalog);
    await resourcesDownloadHelpers.downloadResources(languageList, resourcesPath.name, resources)
      .then(resourcesDownloaded => {
        console.log(resourcesDownloaded);
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
    await expect(resourcesDownloadHelpers.downloadResources(languageList, resourcesPath.name, resources)).resolves.toEqual(expectedResolve);
  });
});
