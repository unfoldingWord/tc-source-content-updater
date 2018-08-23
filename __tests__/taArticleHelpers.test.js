import fs from 'fs-extra';
import path from 'path-extra';
// helpers
import * as taArticleHelpers from '../src/helpers/translationHelps/taArticleHelpers';
import * as resourcesHelpers from '../src/helpers/resourcesHelpers';
// constants
import * as errors from '../src/errors';

describe('Tests for taArticleHelpers', function() {
  const resource = {
    languageId: 'en',
    resourceId: 'ta',
    version: '9'
  };

  beforeEach(() => {
    fs.__resetMockFS();
  });

  it('Test taArticleHelpers.processTranslationAcademy() for en', () => {
    // given
    const actualExtractedPath = path.join(__dirname, 'fixtures/translationHelps/taExtractedFromCDN');
    const mockedExtractedPath = '/tmp/resources/imports/en_ta';
    fs.__loadDirIntoMockFs(actualExtractedPath, mockedExtractedPath);
    const outputPath = '/tmp/resources/imports/en_ta_processed';
    fs.ensureDirSync(outputPath);
    const expectedProjectList = ['checking', 'translate'];
    const expectedCheckingArticleListLength = 6;
    const expectedTranslateArticleListLength = 4;

    // when
    const result = taArticleHelpers.processTranslationAcademy(resource, path.join(mockedExtractedPath, resource.languageId + '_' + resource.resourceId), outputPath);
    const projectList = fs.readdirSync(outputPath);
    const checkingArticleList = fs.readdirSync(path.join(outputPath, 'checking'));
    const translateArticleList = fs.readdirSync(path.join(outputPath, 'translate'));
    const whatisFile = path.join(outputPath, 'translate', 'translate-whatis.md');
    const whatisArticle = fs.readFileSync(whatisFile, 'utf8');

    // then
    expect(result).toBeTruthy();
    expect(fs.existsSync(whatisFile)).toBeTruthy();
    expect(projectList.sort()).toEqual(expectedProjectList);
    expect(checkingArticleList.length).toEqual(expectedCheckingArticleListLength);
    expect(checkingArticleList).toMatchSnapshot();
    expect(translateArticleList.length).toEqual(expectedTranslateArticleListLength);
    expect(translateArticleList).toMatchSnapshot();
    expect(whatisArticle).toMatchSnapshot();
  });

  it('Test taArticlesHelpers.processTranslationAcademy() for invalid source path', () => {
    // given
    const sourcePath = '/bad/dir';
    const outputPath = '/tmp/resources/imports/en_ta_processed';
    const expectedError = resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_EXIST);

    // when
    expect(() => taArticleHelpers.processTranslationAcademy(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test taArticlesHelpers.processTranslationAcademy() for no source path given', () => {
    // given
    const sourcePath = null;
    const outputPath = '/tmp/resources/imports/en_ta_processed';
    const expectedError = errors.SOURCE_PATH_NOT_GIVEN;

    // when
    expect(() => taArticleHelpers.processTranslationAcademy(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test taArticlesHelpers.processTranslationAcademy() for no resource given', () => {
    // given
    const sourcePath = '/tmp/resources/imports/en_ta';
    const outputPath = '/tmp/resources/imports/en_ta_processed';
    const resource = null;
    fs.ensureDirSync(sourcePath);
    const expectedError = errors.RESOURCE_NOT_GIVEN;

    // when
    expect(() => taArticleHelpers.processTranslationAcademy(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test taArticlesHelpers.processTranslationAcademy() for invalid output path', () => {
    // given
    const sourcePath = '/tmp/resources/imports/en_ta';
    const outputPath = null;
    fs.ensureDirSync(sourcePath);
    const expectedError = resourcesHelpers.formatError(resource, errors.OUTPUT_PATH_NOT_GIVEN);

    // when
    expect(() => taArticleHelpers.processTranslationAcademy(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

});
