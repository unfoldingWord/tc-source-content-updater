/* eslint-disable require-jsdoc,quote-props */
/* eslint-env jest */
import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
// helpers
import * as packageParseHelpers from '../src/helpers/packageParseHelpers';
import * as bible from '../src/resources/bible';
import * as resourcesHelpers from '../src/helpers/resourcesHelpers';
// constants
import * as errors from '../src/resources/errors';

const BOOKS_OF_THE_BIBLE = Object.keys(bible.BOOK_CHAPTER_VERSES);

const enUltResource = {
  languageId: 'en',
  resourceId: 'ulb',
  remoteModifiedTime: '2017-12-07T23:45:40+00:00',
  downloadUrl: 'https://cdn.door43.org/en/ulb/v12/ulb.zip',
  version: '12',
  subject: 'Bible',
  catalogEntry: {
    subject: {},
    resource: {},
    format: {
      format: 'application/zip; type=bundle content=text/usfm conformsto=rc0.2',
      modified: '2017-12-07T23:45:40+00:00',
      signature: 'https://cdn.door43.org/en/ulb/v12/ulb.zip.sig',
      size: 1439488,
      url: 'https://cdn.door43.org/en/ulb/v12/ulb.zip'
    }
  }
};

const grcUgntResource = {
  languageId: 'el-x-koine',
  resourceId: 'ugnt',
  remoteModifiedTime: '2018-08-02T17:46:25+00:00',
  downloadUrl: 'https://cdn.door43.org/el-x-koine/ugnt/v0.2/ugnt.zip',
  version: '0.2',
  subject: 'Greek_New_Testament',
  catalogEntry: {
    subject: {}
  },
  resource: {},
  format: {
    format: 'application/zip; type=bundle content=text/usfm3 conformsto=rc0.2',
    modified: '2018-08-02T17:46:25+00:00',
    signature: 'https://cdn.door43.org/el-x-koine/ugnt/v0.2/ugnt.zip.sig',
    size: 1465124,
    url: 'https://cdn.door43.org/el-x-koine/ugnt/v0.2/ugnt.zip'
  }
};

describe('parseBiblePackage()', () => {
  const NT_BOOKS = bible.BIBLE_LIST_NT.map(bookName => getBookCode(bookName));

  beforeEach(() => {
    // reset mock filesystem data
    fs.__resetMockFS();
  });

  afterEach(() => {
    fs.__resetMockFS();
  });

  it('en_ult should pass', () => {
    // given
    const sourceBible = 'en_ult';
    const PROJECTS_PATH = path.join(ospath.home(), 'resources/import');
    const resultsPath = path.join(ospath.home(), 'resources/results');
    fs.__loadFilesIntoMockFs([sourceBible], './__tests__/fixtures', PROJECTS_PATH);
    let packagePath = path.join(PROJECTS_PATH, sourceBible);
    const resource = enUltResource;

    // when
    const results = packageParseHelpers.parseBiblePackage(resource, packagePath, resultsPath);

    // then
    expect(results).toBeTruthy();
    verifyBibleResults(resultsPath, BOOKS_OF_THE_BIBLE);
    verifyCatalogModifiedTimeInManifest(resultsPath, resource);
  });

  it('en_ult should pass with uppercase book ID', () => {
    // given
    const sourceBible = 'en_ult';
    const PROJECTS_PATH = path.join(ospath.home(), 'resources/import');
    const resultsPath = path.join(ospath.home(), 'resources/results');
    fs.__loadFilesIntoMockFs([sourceBible], './__tests__/fixtures', PROJECTS_PATH);
    let packagePath = path.join(PROJECTS_PATH, sourceBible);
    modifyFile(packagePath, "manifest.yaml", "identifier: 'gen'", "identifier: 'GEN'");
    const resource = enUltResource;

    // when
    const results = packageParseHelpers.parseBiblePackage(resource, packagePath, resultsPath);

    // then
    expect(results).toBeTruthy();
    verifyBibleResults(resultsPath, BOOKS_OF_THE_BIBLE);
    verifyCatalogModifiedTimeInManifest(resultsPath, resource);
  });

  it('en_ult should throw error with invalid book ID', () => {
    // given
    const sourceBible = 'en_ult';
    const PROJECTS_PATH = path.join(ospath.home(), 'resources/import');
    const resultsPath = path.join(ospath.home(), 'resources/results');
    fs.__loadFilesIntoMockFs([sourceBible], './__tests__/fixtures', PROJECTS_PATH);
    let packagePath = path.join(PROJECTS_PATH, sourceBible);
    modifyFile(packagePath, "manifest.yaml", "identifier: 'gen'", "identifier: 'GE'");
    const resource = enUltResource;
    const expectedError = resourcesHelpers.formatError(resource, errors.ERROR_PARSING_BIBLE + ": " + errors.INVALID_BOOK_CODE + ": ge");

    // when
    expect(() => packageParseHelpers.parseBiblePackage(resource, packagePath, resultsPath)).toThrowError(expectedError);
  });

  it('el-x-koine_ugnt should pass', () => {
    const sourceBible = 'el-x-koine_ugnt';
    const PROJECTS_PATH = path.join(ospath.home(), 'resources/import');
    const resultsPath = path.join(ospath.home(), 'resources/results');
    fs.__loadFilesIntoMockFs([sourceBible], './__tests__/fixtures', PROJECTS_PATH);
    let packagePath = path.join(PROJECTS_PATH, sourceBible);
    const resource = grcUgntResource;
    const results = packageParseHelpers.parseBiblePackage(resource, packagePath, resultsPath);
    expect(results).toBeTruthy();
    verifyBibleResults(resultsPath, NT_BOOKS, true);
    verifyCatalogModifiedTimeInManifest(resultsPath, resource);
  });

  it('should throw error if manifest not found', () => {
    const sourceBible = 'el-x-koine_ugnt';
    const PROJECTS_PATH = path.join(ospath.home(), 'resources/import');
    const resultsPath = path.join(ospath.home(), 'resources/results');
    const expectedError = resourcesHelpers.formatError(grcUgntResource, errors.ERROR_PARSING_BIBLE + ": " + "Cannot read property 'dublin_core' of null");
    fs.__loadFilesIntoMockFs([sourceBible], './__tests__/fixtures', PROJECTS_PATH);
    let packagePath = path.join(PROJECTS_PATH, sourceBible);
    fs.removeSync(path.join(packagePath, 'manifest.yaml'));
    expect(() => packageParseHelpers.parseBiblePackage(grcUgntResource, packagePath, resultsPath)).toThrowError(expectedError);
  });

  it('should throw error if sourcePath does not exist', () => {
    const sourceBible = 'en_ult';
    const PROJECTS_PATH = path.join(ospath.home(), 'resources/import');
    let packagePath = path.join(PROJECTS_PATH, sourceBible);
    const resultsPath = path.join(ospath.home(), 'resources/results');
    const expectedError = resourcesHelpers.formatError(enUltResource, errors.SOURCE_PATH_NOT_EXIST);
    expect(() => packageParseHelpers.parseBiblePackage(enUltResource, packagePath, resultsPath)).toThrowError(expectedError);
  });

  it('null sourcePath should throw error', () => {
    const resultsPath = path.join(ospath.home(), 'resources/results');
    const expectedError = resourcesHelpers.formatError(enUltResource, errors.SOURCE_PATH_NOT_GIVEN);
    expect(() => packageParseHelpers.parseBiblePackage(enUltResource, null, resultsPath)).toThrowError(expectedError);
  });

  it('null outputPath should throw error', () => {
    const sourceBible = 'el-x-koine_ugnt';
    const PROJECTS_PATH = path.join(ospath.home(), 'resources/import');
    fs.__loadFilesIntoMockFs([sourceBible], './__tests__/fixtures', PROJECTS_PATH);
    let packagePath = path.join(PROJECTS_PATH, sourceBible);
    const expectedError = resourcesHelpers.formatError(grcUgntResource, errors.OUTPUT_PATH_NOT_GIVEN);
    expect(() => packageParseHelpers.parseBiblePackage(grcUgntResource, packagePath, null)).toThrowError(expectedError);
  });

  it('null resourceEntry should throw error', () => {
    const sourceBible = 'el-x-koine_ugnt';
    const PROJECTS_PATH = path.join(ospath.home(), 'resources/import');
    fs.__loadFilesIntoMockFs([sourceBible], './__tests__/fixtures', PROJECTS_PATH);
    let packagePath = path.join(PROJECTS_PATH, sourceBible);
    const resultsPath = path.join(ospath.home(), 'resources/results');
    const expectedError = resourcesHelpers.formatError(null, errors.RESOURCE_NOT_GIVEN);
    expect(() => packageParseHelpers.parseBiblePackage(null, packagePath, resultsPath)).toThrowError(expectedError);
  });
});

//
// helpers
//

/**
 * lookup number of chapters in book
 * @param {String} bookID - book to look up
 * @return {number} chapter count
 */
function getChapterCount(bookID) {
  const bookObj = bible.BOOK_CHAPTER_VERSES[bookID];
  if (bookObj) {
    return Object.keys(bookObj).length;
  }
  return 0;
}

/**
 * verifies the parsed bible
 * @param {String} resultsPath - path to the results
 * @param {Array} verifyBooks - array of expected books
 * @param {Boolean} isOL - if true then this is an Original Language
 */
function verifyBibleResults(resultsPath, verifyBooks, isOL = false) {
  for (let bookId of verifyBooks) {
    const bookPath = path.join(resultsPath, bookId);
    expect(fs.pathExistsSync(bookPath)).toBeTruthy();
    let chapterCount = getChapterCount(bookId);
    for (let chapter = 1; chapter <= chapterCount; chapter++) {
      const chapterPath = path.join(bookPath, chapter + '.json');
      expect(fs.pathExistsSync(chapterPath)).toBeTruthy();
    }
  }
  // test manifest
  const manifest = fs.readJSONSync(path.join(resultsPath, 'manifest.json'));
  expect(Object.keys(manifest).length).toBeGreaterThan(10);

  // test index
  const index = fs.readJSONSync(path.join(resultsPath, 'index.json'));
  expect(Object.keys(index).length).toEqual(verifyBooks.length);
  const firstBook = Object.keys(index)[0];
  const chapter1 = index[firstBook][1];
  const expectNumber = !isOL; // should have verse count if not OL
  expect(!isNaN(chapter1)).toEqual(expectNumber);
  if (isOL) { // should be Objects that contains verses
    expect(Object.keys(chapter1).length).toBeGreaterThan(0);
    const verse1 = chapter1[1];
    expect(!isNaN(verse1)).toEqual(true); // verse one should have word count
  }
}

/**
 * @description - split book code out of book name, for example 'mat' from '41-MAT'
 * @param {string} bookName book in format '41-MAT'
 * @return {string} book ID
 */
function getBookCode(bookName) {
  return bookName.split('-')[1].toLowerCase();
}

function verifyCatalogModifiedTimeInManifest(resultsPath, resource) {
  let manifestPath = path.join(resultsPath, 'manifest.json');
  const manifest = fs.readJSONSync(manifestPath);
  expect(manifest.catalog_modified_time).toEqual(resource.remoteModifiedTime);
}

function modifyFile(folderPath, filename, find, replace) {
  const pathToFile = path.join(folderPath, filename);
  let text = fs.readFileSync(pathToFile);
  text = text.replace(find, replace);
  fs.outputFileSync(pathToFile, text);
}
