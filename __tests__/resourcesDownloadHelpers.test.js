jest.unmock('fs-extra');
import tmp from 'tmp';
// helpers
import * as resourcesDownloadHelpers from '../src/helpers/resourcesDownloadHelpers';
import * as parseHelpers from '../src/helpers/parseHelpers';

const catalog = require('./fixtures/catalog');
jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

describe('Tests for resourcesDownloadHelpers', function() {
  const resources = parseHelpers.getLatestResources(catalog, []);
  let resourcesDir = null;

  beforeEach(() => {
    resourcesDir = tmp.dirSync({prefix: 'resources_'});
  });

  afterEach(() => {
    resourcesDir.removeCallback();
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for null', async () => {
    // given
    const languageList = null;
    const expectedError = new Error('Resource list empty');

    // then
    await expect(resourcesDownloadHelpers.downloadResources(languageList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for empty list', async () => {
    // given
    const languageList = [];
    const expectedError = new Error('Resource list empty');

    // then
    await expect(resourcesDownloadHelpers.downloadResources(languageList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for populated language should download zip files', async () => {
    // given
    const languageList = ['hi'];
    const expectedResourcesDownloaded = 9;

    // when
    const resourcesDownloaded = await resourcesDownloadHelpers.downloadResources(languageList, resourcesDir.name, resources);

    // then
    await expect(resourcesDownloaded.length).resolves.toEqual(expectedResourcesDownloaded);
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for populated language list with no resources should pass', async () => {
    // given
    const languageList = ['en', 'hi'];
    const resources = [];
    const expectedResolve = {en: {}, hi: {}};

    // then
    await expect(resourcesDownloadHelpers.downloadResources(languageList, resources)).resolves.toEqual(expectedResolve);
  });
});
