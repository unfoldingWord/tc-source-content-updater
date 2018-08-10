/* eslint-disable require-jsdoc */
/* eslint-env jest */
import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
// helpers
import * as packageParseHelpers from '../src/helpers/packageParseHelpers';
import * as bible from '../src/resources/bible';

const BOOKS_OF_THE_BIBLE = Object.keys(bible.BOOK_CHAPTER_VERSES);

describe('packageParseHelpers: ', () => {

  describe('parseBiblePackage()', () => {

    beforeEach(() => {
      // reset mock filesystem data
      fs.__resetMockFS();
    });

    afterEach(() => {
      fs.__resetMockFS();
    });

    it('should pass', () => {
      const sourceBible = 'en_ult';
      const PROJECTS_PATH = path.join(ospath.home(), 'resources/import');
      const resultsPath = path.join(ospath.home(), 'resources/results');
      fs.__loadFilesIntoMockFs([sourceBible], './__tests__/fixtures', PROJECTS_PATH);
      let packagePath = path.join(PROJECTS_PATH, sourceBible);
      const results = packageParseHelpers.parseBiblePackage(packagePath,
        resultsPath);
      expect(results).toBeTruthy();
      verifyBibleResults(resultsPath);
    });
  });
});

//
// helpers
//

function getChapterCount(bookID) {
  const bookObj = bible.BOOK_CHAPTER_VERSES[bookID];
  if (bookObj) {
    return Object.keys(bookObj).length;
  }
  return 0;
}

function verifyBibleResults(resultsPath) {
  for (let bookId of BOOKS_OF_THE_BIBLE) {
    const bookPath = path.join(resultsPath, bookId);
    console.log("Testing Book " + bookId);
    expect(fs.pathExistsSync(bookPath)).toBeTruthy();
    let chapterCount = getChapterCount(bookId);
    for (let chapter = 1; chapter <= chapterCount; chapter++) {
      const chapterPath = path.join(bookPath, chapter + '.json');
      expect(fs.pathExistsSync(chapterPath)).toBeTruthy();
    }
    const manifest = fs.readJSONSync(path.join(resultsPath, 'manifest.json'));
    expect(Object.keys(manifest).length).toBeGreaterThan(10);
    const index = fs.readJSONSync(path.join(resultsPath, 'index.json'));
    expect(Object.keys(index).length).toEqual(66);
  }
}
