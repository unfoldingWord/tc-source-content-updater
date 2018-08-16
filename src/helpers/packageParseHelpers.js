/* eslint-disable camelcase */
/**
 * packageParseHelpers.js - methods for processing manifest and USFM files to verseObjects
 */

import fs from 'fs-extra';
import path from 'path-extra';
import usfm from 'usfm-js';
import * as bible from '../resources/bible';
import assert from 'assert';
import {generateBibleManifest} from "./biblesHelpers";
import {getResourceManifest} from "./resourcesHelpers";

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
export function parseManifest(extractedFilePath, outputPath) {
  let oldManifest = getResourceManifest(extractedFilePath);
  return generateBibleManifest(oldManifest, outputPath);
}

/**
 * Parse the bible package to generate json bible contents, manifest, and index
 * @param {{
 *                   languageId: String,
 *                   resourceId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {langResource, bookResource, format}
 *                 }} resourceEntry - resource entry for download
 * @param {String} extractedFilesPath - path to unzipped files from bible package
 * @param {String} resultsPath - path to store processed bible
 * @return {Boolean} true if success
 */
export function parseBiblePackage(resourceEntry, extractedFilesPath, resultsPath) {
  const index = {};
  try {
    if (!resourceEntry) {
      console.log("resourceEntry missing");
      return false;
    }
    if (!fs.pathExistsSync(extractedFilesPath)) {
      console.log("Source folder does not exist: " + extractedFilesPath);
      return false;
    }
    if (!resultsPath) {
      console.log("resultsPath missing");
      return false;
    }
    const manifest = parseManifest(extractedFilesPath,
      resultsPath);
    if (!manifest.projects) {
      console.log("Manifest does not contain index to books");
      return false;
    }

    manifest.catalog_modified_time = resourceEntry.remoteModifiedTime;
    let savePath = path.join(extractedFilesPath, 'manifest.json');
    fs.outputJsonSync(savePath, manifest);

    const projects = manifest.projects || [];
    for (let project of projects) {
      if (project.identifier && project.path) {
        let bookPath = path.join(resultsPath, project.identifier);
        parseUsfmOfBook(path.join(extractedFilesPath, project.path), bookPath);
        indexBook(bookPath, index, project.identifier);
      }
    }
    saveIndex(resultsPath, index);
  } catch (error) {
    console.log("Error Parsing bible:");
    console.log(error);
    return false;
  }
  return true;
}

/**
 * @description - update index with chapter/verse/words for specified book code
 * @param {string} bookPath - path to books
 * @param {Object} index - data for index.json
 * @param {string} bookCode - book to index
 */
function indexBook(bookPath, index, bookCode) {
  const expectedChapters = bible.BOOK_CHAPTER_VERSES[bookCode];
  const files = fs.readdirSync(bookPath);
  const chapterCount = Object.keys(expectedChapters).length;
  assert.deepEqual(files.length, chapterCount);
  const bookIndex = {};
  index[bookCode] = bookIndex;

  // add chapters
  for (let chapter of Object.keys(expectedChapters)) {
    const chapterIndex = {};
    bookIndex[chapter] = chapterIndex;
    const expectedVerseCount = parseInt(expectedChapters[chapter], 10);
    const chapterPath = path.join(bookPath, chapter + ".json");
    const ugntChapter = fs.readJSONSync(chapterPath);
    const ugntVerses = Object.keys(ugntChapter);
    let frontPos = ugntVerses.indexOf("front");
    if (frontPos >= 0) { // remove chapter front matter
      ugntVerses.splice(frontPos, 1); // remove front item
    }
    if (ugntVerses.length !== expectedVerseCount) {
      console.warn(`WARNING: ${bookCode} - in chapter ${chapter}, found ${ugntVerses.length} verses but should be ${expectedVerseCount} verses`);
    }

    // add verses
    for (let verse of ugntVerses) {
      let words = ugntChapter[verse];
      if (words.verseObjects) { // check for new verse objects support
        words = words.verseObjects;
      }
      chapterIndex[verse] = words.length;
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
