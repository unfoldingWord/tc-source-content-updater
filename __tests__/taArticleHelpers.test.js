import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
import { convertTsv9to7 } from 'tsv-groupdata-parser';
// helpers
import * as taArticleHelpers from '../src/helpers/translationHelps/taArticleHelpers';
import * as resourcesHelpers from '../src/helpers/resourcesHelpers';
// constants
import * as errors from '../src/resources/errors';

describe('Tests for taArticleHelpers', function() {
  const resource = {
    languageId: 'en',
    resourceId: 'ta',
    version: '9'
  };

  beforeEach(() => {
    fs.__resetMockFS();
  });

  // __tests__/fixtures/translationHelps/tnExtractedFromCDN/en_tn/en_tn_57-TIT.tsv
  // convertTsv9to7(tsv_)

  it('test convertTsv9to7', () => {
    const actualFilePath = path.join(__dirname, 'fixtures/translationHelps/tnExtractedFromCDN/en_tn/en_tn_57-TIT.tsv');
    const tsv = fs.__actual.readFileSync(actualFilePath, 'utf8');

    // import { convertTsv9to7 } from 'tsv-groupdata-parser';
    const result = convertTsv9to7(tsv);

    // then
    expect(result.tsv).toBeTruthy();
    expect(result.errors).toBeFalsy();
  });

  it('Test taArticleHelpers.processTranslationAcademy() for en', () => {
    // given
    const actualExtractedPath = path.join(__dirname, 'fixtures/translationHelps/taExtractedFromCDN');
    const mockedExtractedPath = path.join(ospath.home(), 'translationCore/resources/imports/en_ta');
    fs.__loadDirIntoMockFs(actualExtractedPath, mockedExtractedPath);
    const outputPath = path.join(ospath.home(), 'translationCore/resources/imports/en_ta_processed');
    fs.ensureDirSync(outputPath);
    const expectedProjectList = ['checking', 'translate'];
    const expectedCheckingArticleListLength = 6;
    const expectedTranslateArticleListLength = 5;

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
    const outputPath = path.join(ospath.home(), 'translationCore/resources/imports/en_ta_processed');
    const expectedError = resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_EXIST);

    // when
    expect(() => taArticleHelpers.processTranslationAcademy(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test taArticlesHelpers.processTranslationAcademy() for no source path given', () => {
    // given
    const sourcePath = null;
    const outputPath = path.join(ospath.home(), 'translationCore/resources/imports/en_ta_processed');
    const expectedError = errors.SOURCE_PATH_NOT_GIVEN;

    // when
    expect(() => taArticleHelpers.processTranslationAcademy(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test taArticlesHelpers.processTranslationAcademy() for no resource given', () => {
    // given
    const sourcePath = path.join(ospath.home(), 'translationCore/resources/imports/en_ta');
    const outputPath = path.join(ospath.home(), 'translationCore/resources/imports/en_ta_processed');
    const resource = null;
    fs.ensureDirSync(sourcePath);
    const expectedError = errors.RESOURCE_NOT_GIVEN;

    // when
    expect(() => taArticleHelpers.processTranslationAcademy(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test taArticlesHelpers.processTranslationAcademy() for invalid output path', () => {
    // given
    const sourcePath = path.join(ospath.home(), 'translationCore/resources/imports/en_ta');
    const outputPath = null;
    fs.ensureDirSync(sourcePath);
    const expectedError = resourcesHelpers.formatError(resource, errors.OUTPUT_PATH_NOT_GIVEN);

    // when
    expect(() => taArticleHelpers.processTranslationAcademy(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

});
