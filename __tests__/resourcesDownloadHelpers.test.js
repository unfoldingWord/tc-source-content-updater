import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
// helpers
import * as resourcesDownloadHelpers from '../src/helpers/resourcesDownloadHelpers';
import * as parseHelpers from '../src/helpers/parseHelpers';
// constants
import * as errors from '../src/resources/errors';
import Updater from '../src';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Tests for resourcesDownloadHelpers.downloadResources()', function() {
  const updater = new Updater();
  const resources = parseHelpers.getLatestResources(loadMockedResources(updater), []);
  const resourcesPath = path.join(ospath.home(), 'translationCore/resources'); // a mocked resources directory
  beforeEach(() => {
    fs.__resetMockFS();
    fs.ensureDirSync(resourcesPath);
  });

  it('Test resourcesDownloadHelpers.downloadResources() for null', async () => {
    const languageList = null;
    const expectedError = errors.LANGUAGE_LIST_EMPTY;
    return resourcesDownloadHelpers.downloadResources(languageList).catch((err) => {
      expect(err).toEqual(expectedError);
    });
  });

  it('Test resourcesDownloadHelpers.downloadResources() for empty list', async () => {
    const languageList = [];
    const expectedError = errors.LANGUAGE_LIST_EMPTY;
    return resourcesDownloadHelpers.downloadResources(languageList).catch((err) => {
      expect(err).toEqual(expectedError);
    });
  });

  it('Test resourcesDownloadHelpers.downloadResources() for "hi" should download, process and deploy all resources', async () => {
    const languageList = ['hi'];
    const expectedLength = 2;
    return resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources).then((res) => {
      expect(res).toHaveLength(expectedLength);
    });
  });

  it('Test resourcesDownloadHelpers.downloadResources() for "el-x-koine" should download, process and deploy the Bible and the tW Group Data', async () => {
    const languageList = ['el-x-koine'];
    const expectedLength = 1;
    return resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources).then((res) => {
      expect(res).toHaveLength(expectedLength);
    });
  });

  it('Test resourcesDownloadHelpers.downloadResources() for populated language list with no resources should pass', async () => {
    const languageList = ['en', 'hi'];
    const resources = [];
    const expectedResolve = [];
    return resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources).then((res) => {
      expect(res).toEqual(expectedResolve);
    });
  });

  it('Test resourcesDownloadHelpers.downloadResources() for empty language list and allAlignedBibles should pass', async () => {
    const languageList = [];
    const expectedLength = 4;
    const allAlignedBibles = true;
    const downloadErrors = [];
    return resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources, downloadErrors, allAlignedBibles).then((res) => {
      expect(res).toHaveLength(expectedLength);
    });
  });

  it('Test resourcesDownloadHelpers.downloadResources() for empty language list and allAlignedBibles should remove duplicates', async () => {
    const languageList = [];
    const expectedLength = 4;
    const allAlignedBibles = true;
    const downloadErrors = [];
    const resources_ = [...resources];
    // eslint-disable-next-line camelcase
    const en_ult = resourcesDownloadHelpers.findMatchingResource(resources, 'en', 'ult');
    resources_.push(en_ult);
    return resourcesDownloadHelpers.downloadResources(languageList, resourcesPath, resources_, downloadErrors, allAlignedBibles).then((res) => {
      expect(res).toHaveLength(expectedLength);
    });
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
        format: {},
      },
    };
    return resourcesDownloadHelpers.downloadAndProcessResource(resource, resourcesPath).then((res) => {
      expect(res).toEqual(resource);
    });
  });

  it('Test resourcesDownloadHelpers.downloadAndProcessResource() for el-x-koine UGNT', () => {
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
        format: {},
      },
    };
    return resourcesDownloadHelpers.downloadAndProcessResource(resource, resourcesPath).then((res) => {
      expect(res).toEqual(resource);
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
  return updater.remoteCatalog;
}
