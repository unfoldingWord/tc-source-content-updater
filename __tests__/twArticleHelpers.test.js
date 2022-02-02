import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
// helpers
import * as twArticleHelpers from '../src/helpers/translationHelps/twArticleHelpers';
import * as resourcesHelpers from '../src/helpers/resourcesHelpers';
// constants
import * as errors from '../src/resources/errors';
import {DOOR43_CATALOG} from '../src/helpers/apiHelpers';

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

    // when
    const result = twArticleHelpers.processTranslationWords(resource, path.join(mockedExtractedPath, resource.languageId + '_' + resource.resourceId), outputPath);
    const indexFile = path.join(outputPath, 'kt', 'index.json');
    const indexJson = fs.readJsonSync(indexFile);
    const typeList = fs.readdirSync(outputPath);
    const ktArticleList = fs.readdirSync(path.join(outputPath, 'kt', 'articles'));
    const namesArticleList = fs.readdirSync(path.join(outputPath, 'names', 'articles'));
    const godFile = path.join(outputPath, 'kt', 'articles', 'god.md');
    const godArticle = fs.readFileSync(godFile, 'utf8');

    // then
    expect(result).toBeTruthy();
    expect(fs.existsSync(indexFile)).toBeTruthy();
    expect(indexJson).toEqual(expectedIndexJson);
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

  it('Test twArticlesHelpers.processTranslationWord() forresource not given', () => {
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
