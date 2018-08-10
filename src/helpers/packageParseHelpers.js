/**
 * packageParseHelpers.js - methods for processing manifest and USFM files to verseObjects
 */

import fs from 'fs-extra';
import path from 'path-extra';
import usfm from 'usfm-js';
import * as bible from '../resources/bible';
import assert from 'assert';
import {getResourceManifestFromYaml, generateBibleManifest} from "./biblesHelpers";

/**
 * @description - This function outputs chapter files from an input usfm file
 * @param {String} usfmPath - Path of the usfm file
 * @param {String} outputPath - Path to store the chapter json files as output
 */
export const parseUsfmOfBook = (usfmPath, outputPath) => {
  const usfmData = fs.readFileSync(usfmPath, 'UTF-8').toString();
  const converted = usfm.toJSON(usfmData, {convertToInt: ["occurrence", "occurrences"]});
  const {chapters} = converted;
  Object.keys(chapters).forEach(chapter => {
    fs.outputFileSync(path.join(outputPath, chapter + '.json'), JSON.stringify(chapters[chapter], null, 2));
  });
};

/**
 * parses manifest.yaml data to create manifest.json
 * @param {String} extractedFilePath - path containing manifest.yaml
 * @param {string} outputPath - path to place manifest.json
 * @return {Object} new manifest data
 */
export function parseManifestYaml(extractedFilePath, outputPath) {
  let oldManifest = getResourceManifestFromYaml(extractedFilePath);
  return generateBibleManifest(oldManifest, outputPath);
}

/**
 * Parse the bible package to generate json bible contents, manifest, and index
 * @param {String} packagePath - path to downloaded package
 * @param {String} resultsPath - path to store processed bible
 * @return {Boolean} true if success
 */
export function parseBiblePackage(packagePath, resultsPath) {
  try {
    const manifest = parseManifestYaml(packagePath,
      resultsPath);
    const projects = manifest.projects || [];
    for (let project of projects) {
      if (project.identifier && project.path) {
        parseUsfmOfBook(path.join(packagePath, project.path),
          path.join(resultsPath, project.identifier));
      }
    }
    // TODO: make index
  } catch (error) {
    return false;
  }
  return true;
}

/**
 * @description - split book code out of book name, for example 'mat' from '41-MAT'
 * @param {string} bookName book in format '41-MAT'
 * @return {string} book code
 */
function getBookCode(bookName) {
  return bookName.split('-')[1].toLowerCase();
}

/**
 * @description - update index with chapter/verse/words for specified book code
 * @param {string} bookPath - path to books
 * @param {Object} index - data for index.json
 * @param {string} bookCode - book to index
 */
function indexBook(bookPath, index, bookCode) {
  console.log("Indexing " + bookCode);
  const expectedChapters = bible.BOOK_CHAPTER_VERSES[bookCode];
  const files = fs.readdirSync(bookPath);
  const chapterCount = Object.keys(expectedChapters).length;
  console.log(`${bookCode} - found ${chapterCount} chapters`);
  assert.deepEqual(files.length, chapterCount);
  const bookIndex = {};
  index[bookCode] = bookIndex;

  // add chapters
  for (let chapter of Object.keys(expectedChapters)) {
    const chapterIndex = {};
    bookIndex[chapter] = chapterIndex;
    const expectedVerseCount = parseInt(expectedChapters[chapter], 10);
    const chapterPath = path.join(bookPath, bookCode, chapter + ".json");
    const ugntChapter = JSON.parse(fs.readFileSync(chapterPath));
    const ugntVerses = Object.keys(ugntChapter);
    let frontPos = ugntVerses.indexOf("front");
    if (frontPos >= 0) { // remove chapter front matter
      ugntVerses.splice(frontPos, 1); // remove front item
    }
    console.log(`${bookCode} - in chapter ${chapter}, found ${ugntVerses.length} verses`);
    if (ugntVerses.length !== expectedVerseCount) {
      console.warn(`WARNING: ${bookCode} - in chapter ${chapter}, found ${ugntVerses.length} verses but should be ${expectedVerseCount} verses`);
    }

    // add verses
    for (let verse of ugntVerses) {
      let words = ugntChapter[verse];
      if (words.verseObjects) { // check for new verse objects support
        words = words.verseObjects;
      }
      const wordCount = words.length;
      chapterIndex[verse] = wordCount;
    }
  }
}

/**
 * @description save index to index.json
 * @param {String} outputFolder - where to put index.json
 * @param {Object} index - data for index.json
 */
function saveIndex(outputFolder, index) {
  const indexPath = path.join(outputFolder, 'index.json');
  if (fs.existsSync(indexPath)) {
    const tempPath = indexPath + "_temp";
    fs.moveSync(indexPath, tempPath);
    fs.removeSync(tempPath);
  }
  const indexStr = JSON.stringify(index, null, 2);
  fs.outputFileSync(indexPath, indexStr, 'UTF-8');
}

/**
 * @description - make index of all the books
 * @param {string} outputFolder - path to put index and find book data
 * @param {Array} books to index
 */
export function generateIndex(outputFolder, books) {
  let index = {};
  for (let book of books) {
    const bookCode = getBookCode(book);
    indexBook(index, bookCode);
  }
  saveIndex(index);
}

