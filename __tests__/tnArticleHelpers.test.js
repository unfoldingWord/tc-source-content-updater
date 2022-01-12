/* eslint-disable quotes */
/* eslint-env jest */
import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
// helpers
import * as tnArticleHelpers from '../src/helpers/translationHelps/tnArticleHelpers';
import * as resourcesHelpers from '../src/helpers/resourcesHelpers';
// constants
import * as errors from '../src/resources/errors';
import * as twArticleHelpers from "../src/helpers/translationHelps/twArticleHelpers";

const mockGetMissingOriginalResource = async (resourcesPath, originalLanguageId, originalLanguageBibleId, version, callLog) => {
  callLog.push({resourcesPath, originalLanguageId, originalLanguageBibleId, version}); // TRICKY - for ease of testing we are hijacking the DownloadErrors to keep track of calls
};

describe('Tests for tnArticleHelpers.getMissingResources()', function() {
  beforeEach(() => {
    fs.__resetMockFS();
  });

  it('Test for en with no dependencies', async () => {
    // given
    const fixturePath = path.join(__dirname, 'fixtures/translationHelps/tnExtractedFromCDN');
    const resourcesPath = path.join(ospath.home(), 'translationCore/resources');
    const importsPath = path.join(ospath.home(), resourcesPath, 'imports');
    fs.__loadDirIntoMockFs(fixturePath, importsPath);
    const sourcePath = path.join(importsPath, 'en_tn');
    const expectedCalls = [];
    const callLog = [];
    fs.writeJsonSync(path.join(resourcesPath, 'en', 'translationHelps/translationAcademy', 'v1_Door43-Catalog', 'manifest.json'), {}); // make dummy manifest for tA

    // when
    const {otQuery, ntQuery} = await tnArticleHelpers.getMissingResources(sourcePath, resourcesPath, mockGetMissingOriginalResource, callLog, 'en');

    // then
    validateCallLog(callLog, expectedCalls);
    expect(otQuery).toBeNull();
    expect(ntQuery).toBeNull();
  });

  it('Test for en with dependencies', async () => {
    // given
    const fixturePath = path.join(__dirname, 'fixtures/translationHelps/tnExtractedFromCDN');
    const resourcesPath = path.join(ospath.home(), 'translationCore/resources');
    const importsPath = path.join(ospath.home(), resourcesPath, 'imports');
    fs.__loadDirIntoMockFs(fixturePath, importsPath);
    const sourcePath = path.join(importsPath, 'en_tn');
    const manifestFixturePath = path.join(__dirname, 'fixtures/translationHelps/manifests/en_tn');
    fs.__loadFilesIntoMockFs(['manifest.yaml'], manifestFixturePath, sourcePath);
    const expectedCalls = [
      {
        "originalLanguageBibleId": "uhb",
        "originalLanguageId": "hbo",
        "resourcesPath": path.join(ospath.home(), 'translationCore/resources'),
        "version": "v2.1.9",
      },
      {
        "originalLanguageBibleId": "ugnt",
        "originalLanguageId": "el-x-koine",
        "resourcesPath": path.join(ospath.home(), 'translationCore/resources'),
        "version": "v0.10",
      },
    ];
    const callLog = [];
    const expectedNtQuery = '0.10';
    const expectedOtQuery = '2.1.9';
    fs.writeJsonSync(path.join(resourcesPath, 'en', 'translationHelps/translationAcademy', 'v1_Door43-Catalog', 'manifest.json'), {}); // make dummy manifest for tA

    // when
    const {otQuery, ntQuery} = await tnArticleHelpers.getMissingResources(sourcePath, resourcesPath, mockGetMissingOriginalResource, callLog, 'en');

    // then
    validateCallLog(callLog, expectedCalls);
    expect(ntQuery).toEqual(expectedNtQuery);
    expect(otQuery).toEqual(expectedOtQuery);
  });
});

//
// Helpers
//

/**
 * replace user specific paths in call log
 * @param {Array} callLog
 */
function cleanUpPaths(callLog) {
  const newLog = callLog.map((item) => {
    const newItem = {...item};
    if (item.resourcesPath) {
      const newPath = item.resourcesPath.replace(ospath.home(), '<HOME>');
      newItem.resourcesPath = newPath;
    }
    return newItem;
  });
  return newLog;
}

/**
 * validate call log against expected
 * @param {Array} callLog
 * @param {Array} expectedCalls
 */
function validateCallLog(callLog, expectedCalls) {
  const newCallLog = cleanUpPaths(callLog);
  const newExpectedCallLog = cleanUpPaths(expectedCalls);
  expect(newCallLog).toEqual(newExpectedCallLog);
}

