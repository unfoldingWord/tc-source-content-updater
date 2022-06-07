import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
import _ from 'lodash';
// helpers
import * as twArticleHelpers from '../src/helpers/translationHelps/twArticleHelpers';
import * as resourcesHelpers from '../src/helpers/resourcesHelpers';
import * as errors from '../src/resources/errors';
import {DOOR43_CATALOG} from '../src/helpers/apiHelpers';
import {parseUsfmOfBook} from '../src/helpers/packageParseHelpers';

// constants
const UNFOLDING_WORD = 'unfoldingWord';

describe('Tests for twArticleHelpers', function() {
  const resource = {
    languageId: 'en',
    resourceId: 'tw',
    version: '8',
    owner: DOOR43_CATALOG,
  };

  beforeEach(() => {
    fs.__resetMockFS();
  });

  it('Test twArticleHelpers.processTranslationWordsTSV() for en unfoldingWord', async () => {
    // given
    const resource_ = _.cloneDeep(resource);
    resource_.owner = UNFOLDING_WORD;
    resource_.resourceId = 'twl';
    const actualExtractedPath = path.join(__dirname, 'fixtures/translationHelps/en_twl');
    const mockedExtractedPath = path.join(ospath.home(), 'translationCore/resources/imports');
    fs.__loadDirIntoMockFs(actualExtractedPath, mockedExtractedPath);
    const resourcesPath = path.join(ospath.home(), 'translationCore/resources');
    const outputPath = path.join(resourcesPath, resource.languageId, 'translationHelps/translationWordsLinks', 'v' + resource.version + '_' + resource_.owner);
    fs.ensureDirSync(outputPath);
    const twPath = path.join(resourcesPath, resource.languageId, 'translationHelps/translationWords', 'v' + resource.version + '_' + resource_.owner);
    fs.ensureDirSync(twPath);
    const greekBiblePath = path.join(resourcesPath, 'el-x-koine', 'bibles/ugnt', 'v0.24_' + resource_.owner);
    const greekSource = path.join(__dirname, 'fixtures/el-x-koine_ugnt');
    const greekTemp = path.join(ospath.home(), 'temp/grk');
    const bookFileName = '57-TIT.usfm';
    fs.__loadFilesIntoMockFs([bookFileName], greekSource, greekTemp);
    fs.ensureDirSync(greekBiblePath);
    parseUsfmOfBook(path.join(greekTemp, bookFileName), path.join(greekBiblePath, 'tit'));
    const hebrewBiblePath = path.join(resourcesPath, 'hbo', 'bibles/uhb', 'v2.1.24_' + resource_.owner);
    fs.ensureDirSync(hebrewBiblePath);
    // copy greek to Hebrew as test filler
    fs.copySync(greekBiblePath, hebrewBiblePath);
    const expectedTypeList = ['kt', 'names', 'other'];
    const expectedKtArticleListLength = 56;
    const expectedNamesArticleListLength = 5;
    const downloadErrors = [];

    // when
    const sourcePath1 = path.join(mockedExtractedPath, resource_.languageId + '_' + resource_.resourceId);
    await twArticleHelpers.processTranslationWordsTSV(resource_, sourcePath1, outputPath, resourcesPath, downloadErrors);
    const typeList = fs.readdirSync(outputPath);
    const ktArticlesPath = path.join(outputPath, 'kt/groups/tit');
    const ktArticleList = fs.readdirSync(ktArticlesPath);
    const namesArticlesPath = path.join(outputPath, 'names/groups/tit');
    const namesArticleList = fs.readdirSync(namesArticlesPath);
    const godFile = path.join(ktArticlesPath, 'god.json');
    const godArticle = fs.readJsonSync(godFile);

    // then
    expect(downloadErrors.length).toEqual(0);
    expect(fs.existsSync(godFile)).toBeTruthy();
    expect(typeList).toEqual(expectedTypeList);
    expect(ktArticleList.length).toEqual(expectedKtArticleListLength);
    expect(ktArticleList).toMatchSnapshot();
    expect(godArticle).toMatchSnapshot();
    expect(namesArticleList.length).toEqual(expectedNamesArticleListLength);
    expect(namesArticleList).toMatchSnapshot();
  }, 20000);

  it('Test twArticleHelpers.processTranslationWords() for en', () => {
    // given
    const actualExtractedPath = path.join(__dirname, 'fixtures/translationHelps/twExtractedFromCDN');
    const mockedExtractedPath = path.join(ospath.home(), 'translationCore/resources/imports');
    fs.__loadDirIntoMockFs(actualExtractedPath, mockedExtractedPath);
    const outputPath = path.join(ospath.home(), 'translationCore/resources', resource.languageId, 'translationHelps/translationWords', 'v' + resource.version);
    fs.ensureDirSync(outputPath);
    const expectedTypeList = ['kt', 'names', 'other'];
    const expectedKtArticleListLength = 3;
    const expectedNamesArticleListLength = 2;
    const expectedIndexJson = [
      {id: 'apostle', name: 'apostle, apostles, apostleship'},
      {id: 'god', name: 'God'}, {id: 'sanctify', name: 'sanctify, sanctifies, sanctification'}
    ];
    const resource_ = _.cloneDeep(resource);

    // when
    const result = twArticleHelpers.processTranslationWords(resource_, path.join(mockedExtractedPath, resource_.languageId + '_' + resource_.resourceId), outputPath);
    const typeList = fs.readdirSync(outputPath);
    const ktArticleList = fs.readdirSync(path.join(outputPath, 'kt', 'articles'));
    const namesArticleList = fs.readdirSync(path.join(outputPath, 'names', 'articles'));
    const godFile = path.join(outputPath, 'kt', 'articles', 'god.md');
    const godArticle = fs.readFileSync(godFile, 'utf8');
    const isDoor43 = resource_.owner === DOOR43_CATALOG;

    // then
    expect(result).toBeTruthy();
    if (!isDoor43) {
      const indexFile = path.join(outputPath, 'kt', 'index.json');
      const indexJson = fs.readJsonSync(indexFile);
      expect(fs.existsSync(indexFile)).toBeTruthy();
      expect(indexJson).toEqual(expectedIndexJson);
    }
    expect(fs.existsSync(godFile)).toBeTruthy();
    expect(typeList).toEqual(expectedTypeList);
    expect(ktArticleList.length).toEqual(expectedKtArticleListLength);
    expect(ktArticleList).toMatchSnapshot();
    expect(godArticle).toMatchSnapshot();
    expect(namesArticleList.length).toEqual(expectedNamesArticleListLength);
    expect(namesArticleList).toMatchSnapshot();
  });

  it('Test twArticleHelpers.processTranslationWords() for en unfoldingWord', () => {
    // given
    const actualExtractedPath = path.join(__dirname, 'fixtures/translationHelps/twExtractedFromCDN');
    const mockedExtractedPath = path.join(ospath.home(), 'translationCore/resources/imports');
    fs.__loadDirIntoMockFs(actualExtractedPath, mockedExtractedPath);
    const outputPath = path.join(ospath.home(), 'translationCore/resources', resource.languageId, 'translationHelps/translationWords', 'v' + resource.version);
    fs.ensureDirSync(outputPath);
    const expectedTypeList = ['kt', 'names', 'other'];
    const expectedKtArticleListLength = 3;
    const expectedNamesArticleListLength = 2;
    const expectedIndexJson = [
      {id: 'apostle', name: 'apostle, apostles, apostleship'},
      {id: 'god', name: 'God'}, {id: 'sanctify', name: 'sanctify, sanctifies, sanctification'}
    ];
    const resource_ = _.cloneDeep(resource);
    resource_.owner = UNFOLDING_WORD;

    // when
    const result = twArticleHelpers.processTranslationWords(resource_, path.join(mockedExtractedPath, resource_.languageId + '_' + resource_.resourceId), outputPath);
    const typeList = fs.readdirSync(outputPath);
    const ktArticleList = fs.readdirSync(path.join(outputPath, 'kt', 'articles'));
    const namesArticleList = fs.readdirSync(path.join(outputPath, 'names', 'articles'));
    const godFile = path.join(outputPath, 'kt', 'articles', 'god.md');
    const godArticle = fs.readFileSync(godFile, 'utf8');
    const isDoor43 = resource_.owner === DOOR43_CATALOG;

    // then
    expect(result).toBeTruthy();
    if (!isDoor43) {
      const indexFile = path.join(outputPath, 'kt', 'index.json');
      const indexJson = fs.readJsonSync(indexFile);
      expect(fs.existsSync(indexFile)).toBeTruthy();
      expect(indexJson).toEqual(expectedIndexJson);
    }
    expect(fs.existsSync(godFile)).toBeTruthy();
    expect(typeList).toEqual(expectedTypeList);
    expect(ktArticleList.length).toEqual(expectedKtArticleListLength);
    expect(ktArticleList).toMatchSnapshot();
    expect(godArticle).toMatchSnapshot();
    expect(namesArticleList.length).toEqual(expectedNamesArticleListLength);
    expect(namesArticleList).toMatchSnapshot();
  });

  it('Test twArticlesHelpers.processTranslationWord() for invalid sourcePath', () => {
    // given
    const sourcePath = '/bad/dir';
    const outputPath = path.join(ospath.home(), 'translationCore/resources/imports/en_tw_processed');
    const expectedError = resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_EXIST);

    // when
    expect(() => twArticleHelpers.processTranslationWords(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test twArticlesHelpers.processTranslationWord() for sourcePath not given', () => {
    // given
    const sourcePath = null;
    const outputPath = path.join(ospath.home(), 'translationCore/resources/imports/en_tw_processed');
    const expectedError = resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_GIVEN);

    // when
    expect(() => twArticleHelpers.processTranslationWords(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test twArticlesHelpers.processTranslationWord() for resource not given', () => {
    // given
    const sourcePath = path.join(ospath.home(), 'translationCore/resources/imports/en_tw');
    const outputPath = path.join(ospath.home(), 'translationCore/resources/imports/en_tw_processed');
    const badResource = null;
    fs.ensureDirSync(sourcePath);
    const expectedError = resourcesHelpers.formatError(null, errors.RESOURCE_NOT_GIVEN);

    // when
    expect(() => twArticleHelpers.processTranslationWords(badResource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test twArticlesHelpers.processTranslationWord() for output path not given', () => {
    // given
    const sourcePath = path.join(ospath.home(), 'translationCore/resources/imports/en_tw');
    const outputPath = null;
    fs.ensureDirSync(sourcePath);
    const expectedError = resourcesHelpers.formatError(resource, errors.OUTPUT_PATH_NOT_GIVEN);

    // when
    expect(() => twArticleHelpers.processTranslationWords(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });
});
