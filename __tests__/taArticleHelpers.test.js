import fs from 'fs-extra';
import path from 'path-extra';
// helpers
import * as taArticleHelpers from '../src/helpers/translationHelps/taArticleHelpers';

jest.mock('fs-extra');

describe('Tests for taArticleHelpers', function() {
  beforeEach(() => {
    fs.__resetMockFS();
  });

  it('Test taArticleHelpers.processTranslationAcademy() for en', () => {
    // given
    const lang = 'en';
    const version = 'v9';
    const actualExtractedPath = path.join(__dirname, 'fixtures/translationHelps/taExtractedFromCDN');
    const mockedExtractedPath = '/tmp/extracted';
    fs.__loadDirIntoMockFs(actualExtractedPath, mockedExtractedPath);
    const outputPath = path.join('/resources', lang, 'translationHelps/translationAcademy');
    const expectedTaOutputPath = path.join(outputPath, version);
    const expectedProjectList = ['checking', 'translate'];
    const expectedCheckingArticleListLength = 6;
    const expectedTranslateArticleListLength = 4;

    // when
    const taOutputPath = taArticleHelpers.processTranslationAcademy(path.join(mockedExtractedPath, lang + '_ta'), outputPath);
    const projectList = fs.readdirSync(taOutputPath);
    const checkingArticleList = fs.readdirSync(path.join(taOutputPath, 'checking'));
    const translateArticleList = fs.readdirSync(path.join(taOutputPath, 'translate'));
    const whatisFile = path.join(taOutputPath, 'translate', 'translate-whatis.md');
    const whatisArticle = fs.readFileSync(whatisFile, 'utf8');

    // then
    expect(taOutputPath).toEqual(expectedTaOutputPath);
    expect(fs.existsSync(whatisFile)).toBeTruthy();
    expect(projectList.sort()).toEqual(expectedProjectList);
    expect(checkingArticleList.length).toEqual(expectedCheckingArticleListLength);
    expect(checkingArticleList).toMatchSnapshot();
    expect(translateArticleList.length).toEqual(expectedTranslateArticleListLength);
    expect(translateArticleList).toMatchSnapshot();
    expect(whatisArticle).toMatchSnapshot();
  });

  it('Test taArticlesHelpers.processTranslationAcademy() for invalid extractedFilesDir', () => {
    // given
    const extractedPath = '/bad/dir';
    const lang = 'en';
    const outputPath = path.join('/resources', lang, 'translationHelps/translationAcademy');
    const expectedTaOutputPath = null;

    // when
    const taOutputPath = taArticleHelpers.processTranslationAcademy(extractedPath, outputPath);

    // then
    expect(taOutputPath).toEqual(expectedTaOutputPath);
  });
});
