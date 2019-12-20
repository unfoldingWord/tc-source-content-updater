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

    // when
    const {otQuery, ntQuery} = await tnArticleHelpers.getMissingResources(sourcePath, resourcesPath, mockGetMissingOriginalResource, callLog);

    // then
    expect(callLog).toEqual(expectedCalls);
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
        "resourcesPath": "/Users/blm/translationCore/resources",
        "version": "v2.1.9",
      },
      {
        "originalLanguageBibleId": "ugnt",
        "originalLanguageId": "el-x-koine",
        "resourcesPath": "/Users/blm/translationCore/resources",
        "version": "v0.10",
      },
    ];
    const callLog = [];
    const expectedNtQuery = '0.10';
    const expectedOtQuery = '2.1.9';

    // when
    const {otQuery, ntQuery} = await tnArticleHelpers.getMissingResources(sourcePath, resourcesPath, mockGetMissingOriginalResource, callLog);

    // then
    expect(callLog).toEqual(expectedCalls);
    expect(ntQuery).toEqual(expectedNtQuery);
    expect(otQuery).toEqual(expectedOtQuery);
  });
});
