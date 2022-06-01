/* eslint-disable quotes */
/* eslint-env jest */
import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
// helpers
import * as tnArticleHelpers from '../src/helpers/translationHelps/tnArticleHelpers';
import {DOOR43_CATALOG} from '../src/helpers/apiHelpers';
import _ from "lodash";
import {parseUsfmOfBook} from '../src/helpers/packageParseHelpers';
import * as taArticleHelpers from '../src/helpers/translationHelps/taArticleHelpers';
import deepEqual from 'deep-equal';
// constants

const mockGetMissingOriginalResource = async (resourcesPath, originalLanguageId, originalLanguageBibleId, version, callLog) => {
  callLog.push({resourcesPath, originalLanguageId, originalLanguageBibleId, version}); // TRICKY - for ease of testing we are hijacking the DownloadErrors to keep track of calls
};

describe('Tests parseReference', function() {
  it('Test parseReference for test cases', async () => {
    const tests = [
      {ref: 'front:intro', expect: [{chapter: 'front', verse: 'intro'}]},
      {ref: '1:intro', expect: [{chapter: '1', verse: 'intro'}]},
      {ref: '1:1', expect: [{chapter: '1', verse: '1'}]},
      {ref: '1:1-2', expect: [{chapter: '1', verse: '1-2'}]},
      {ref: '1:1,3', expect: [{chapter: '1', verse: '1'}, {chapter: '1', verse: '3'}]},
      {ref: '1:1-2,4', expect: [{chapter: '1', verse: '1-2'}, {chapter: '1', verse: '4'}]},
      {ref: '1:1-2a,4', expect: [{chapter: '1', verse: '1-2'}, {chapter: '1', verse: '4'}]},
      {ref: '1:1b-2a,4', expect: [{chapter: '1', verse: '1-2'}, {chapter: '1', verse: '4'}]},
      {ref: '1:1-2,4b', expect: [{chapter: '1', verse: '1-2'}, {chapter: '1', verse: '4'}]},
      {ref: '1:1-2,4b,5-7a', expect: [{chapter: '1', verse: '1-2'}, {chapter: '1', verse: '4'}, {chapter: '1', verse: '5-7'}]},
      {ref: '1:1-2;2:4', expect: [{chapter: '1', verse: '1-2'}, {chapter: '2', verse: '4'}]},
      {ref: '1:1c-2b;2:4-5', expect: [{chapter: '1', verse: '1-2'}, {chapter: '2', verse: '4-5'}]},
    ];
    for (const test of tests) {
      const ref = test.ref;
      const expect_ = test.expect;
      const result = tnArticleHelpers.parseReference(ref);
      if (!deepEqual(result, expect_)) {
        console.log(`expect ${ref} to parse to ${JSON.stringify(expect_)}`);
        console.log(`  but got ${JSON.stringify(result)}`);
        expect(result).toEqual(expect_);
      }
    }
  });
});

describe('Tests tnArticleHelpers.processTranslationNotes()', function() {
  const resource = {
    languageId: 'en',
    resourceId: 'tn',
    version: '8',
    owner: DOOR43_CATALOG,
  };

  beforeEach(() => {
    fs.__resetMockFS();
  });

  it('Test tnArticleHelpers.processTranslationNotes() for en', async () => {
    // given
    const actualExtractedPath = path.join(__dirname, 'fixtures/en_tn-7-column');
    const mockedExtractedPath = path.join(ospath.home(), 'translationCore/resources/imports');
    fs.__loadDirIntoMockFs(actualExtractedPath, mockedExtractedPath);
    const resourcesPath = path.join(ospath.home(), 'translationCore/resources');
    const greekBiblePath = path.join(resourcesPath, 'el-x-koine', 'bibles/ugnt', 'v0.20_' + DOOR43_CATALOG);
    const greekSource = path.join(__dirname, 'fixtures/el-x-koine_ugnt');
    const greekTemp = path.join(ospath.home(), 'temp/grk');
    const bookFileName = '57-TIT.usfm';
    fs.__loadFilesIntoMockFs([bookFileName], greekSource, greekTemp);
    fs.ensureDirSync(greekBiblePath);
    parseUsfmOfBook(path.join(greekTemp, bookFileName), path.join(greekBiblePath, 'tit'));
    const hebrewBiblePath = path.join(resourcesPath, 'hbo', 'bibles/uhb', 'v2.1.19_' + DOOR43_CATALOG);
    fs.ensureDirSync(hebrewBiblePath);
    // copy greek to Hebrew as test filler
    fs.copySync(greekBiblePath, hebrewBiblePath);

    const resourcetHelpsPath = path.join(resourcesPath, resource.languageId, 'translationHelps');
    const tA_Path = path.join(resourcetHelpsPath, 'translationAcademy', 'v' + resource.version + '_' + DOOR43_CATALOG);
    const taSource = path.join(__dirname, 'fixtures/translationHelps/taExtractedFromCDN/en_ta');
    const taTemp = path.join(ospath.home(), 'temp/en_ta');
    fs.__loadDirIntoMockFs(taSource, taTemp);
    taArticleHelpers.processTranslationAcademy(resource, taTemp, tA_Path);

    const outputPath = path.join(resourcetHelpsPath, 'translationNotes', 'v' + resource.version + '_' + DOOR43_CATALOG);
    fs.ensureDirSync(outputPath);
    const expectedKtArticleListLength = 3;
    const expectedNamesArticleListLength = 2;
    const expectedIndexJson = [
      {id: 'apostle', name: 'apostle, apostles, apostleship'},
      {id: 'god', name: 'God'}, {id: 'sanctify', name: 'sanctify, sanctifies, sanctification'}
    ];
    const resource_ = _.cloneDeep(resource);
    const sourcePath = path.join(mockedExtractedPath, resource_.languageId + '_' + resource_.resourceId);
    const downloadErrors = [];
    const expectedTypes = [
      "discourse",
      "numbers",
      "figures",
      "culture",
      "grammar",
      "other"
    ];

    // when
    await tnArticleHelpers.processTranslationNotes(resource_, sourcePath, outputPath, resourcesPath, downloadErrors);
    const typeList = fs.readdirSync(outputPath);
    const grammarArticleList = fs.readJsonSync(path.join(outputPath, 'grammar/groups/tit/figs-exclusive.json'));

    // then
    expect(typeList).toEqual(expectedTypes);
    expect(grammarArticleList).toMatchSnapshot();
  }, 20000);
});

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

