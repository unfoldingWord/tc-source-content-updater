/* eslint-disable curly, camelcase */
/**
 * packageParseHelpers.js - methods for processing manifest and USFM files to verseObjects
 */

import fs from 'fs-extra';
import path from 'path-extra';
import usfm from 'usfm-js';
import * as bible from '../resources/bible';
import {isObject} from 'util';
// helpers
import {generateBibleManifest} from './biblesHelpers';
import * as resourcesHelpers from './resourcesHelpers';
// constants
import * as errors from '../resources/errors';

/**
 * @description - This function outputs chapter files from an input usfm file
 * @param {String} usfmPath - Path of the usfm file
 * @param {String} outputPath - Path to store the chapter json files as output
 */
export const parseUsfmOfBook = (usfmPath, outputPath) => {
  const usfmData = fs.readFileSync(usfmPath, 'UTF-8').toString();
  const converted = usfm.toJSON(usfmData, {convertToInt: ['occurrence', 'occurrences']});
  const {chapters} = converted;
  Object.keys(chapters).forEach((chapter) => {
    fs.outputFileSync(path.join(outputPath, chapter + '.json'), JSON.stringify(chapters[chapter], null, 2));
  });
};

/**
 * parses manifest.yaml data to create manifest.json
 * @param {String} extractedFilePath - path containing manifest.yaml
 * @param {string} outputPath - path to place manifest.json
 * @param {Object} resource
 * @return {Object} new manifest data
 */
export function parseManifest(extractedFilePath, outputPath, resource) {
  const oldManifest = resourcesHelpers.getResourceManifest(extractedFilePath);
  if (!oldManifest) {
    console.log(`pareManifest() - manifest not found at ${extractedFilePath}`);
  }
  return generateBibleManifest(oldManifest, outputPath, resource);
}

/**
 * Parse the bible package to generate json bible contents, manifest, and index
 * @param {{
 *          languageId: String,
 *          resourceId: String,
 *          localModifiedTime: String,
 *          remoteModifiedTime: String,
 *          downloadUrl: String,
 *          version: String,
 *          subject: String,
 *          catalogEntry: {langResource, bookResource, format}
 *        }} resource - resource entry for download
 * @param {String} sourcePath - path to unzipped files from bible package
 * @param {String} outputPath - path to store processed bible
 * @return {Boolean} true if success
 */
export function parseBiblePackage(resource, sourcePath, outputPath) {
  const index = {};
  if (!resource || !isObject(resource) || !resource.languageId || !resource.resourceId) {
    throw Error(resourcesHelpers.formatError(resource, errors.RESOURCE_NOT_GIVEN));
  }
  if (!sourcePath) {
    throw Error(resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_GIVEN));
  }
  if (!fs.pathExistsSync(sourcePath)) {
    throw Error(resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_EXIST + ': ' + sourcePath));
  }
  if (!outputPath) {
    throw Error(resourcesHelpers.formatError(resource, errors.OUTPUT_PATH_NOT_GIVEN));
  }
  fs.ensureDirSync(outputPath);
  try {
    const isOL = (resource.resourceId === 'ugnt') || (resource.resourceId === 'uhb');
    const manifest = parseManifest(sourcePath, outputPath, resource);
    if (!manifest.projects) {
      throw Error(resourcesHelpers.formatError(resource, errors.MANIFEST_MISSING_BOOKS));
    }
    manifest.catalog_modified_time = resource.remoteModifiedTime;
    const savePath = path.join(outputPath, 'manifest.json');
    fs.writeFileSync(savePath, JSON.stringify(manifest, null, 2));
    const projects = manifest.projects || [];
    let foundBooks = 0;
    for (const project of projects) {
      if (project.identifier && project.path) {
        const identifier = project.identifier.toLowerCase();
        const bookPath = path.join(outputPath, identifier);
        const usfmPath = path.join(sourcePath, project.path);
        if (!fs.existsSync(usfmPath)) {
          console.warn(`parseBiblePackage() - book missing at ${usfmPath}`);
          continue;
        }
        foundBooks++;
        parseUsfmOfBook(usfmPath, bookPath);
        indexBook(bookPath, index, identifier, isOL);
      }
    }
    if (!foundBooks) {
      throw Error(`parseBiblePackage() - no books found`);
    }
    if (foundBooks < projects.length) {
      console.warn(`parseBiblePackage() - ${projects.length-foundBooks} manifest projects not found`);
    }
    saveIndex(outputPath, index);
  } catch (error) {
    throw Error(resourcesHelpers.formatError(resource, errors.ERROR_PARSING_BIBLE + ': ' + error.message));
  }
  return true;
}

/**
 * get word count for verse - will also recursively check children
 * @param {Array} verseObjects - array to search for verseObjects
 * @return {number} word count found in verseObjects
 */
function getWordCount(verseObjects) {
  let wordCount = 0;
  if (verseObjects && verseObjects.length) {
    for (const item of verseObjects) {
      if (item.type === 'word') {
        wordCount++;
      } else if (item.children) {
        wordCount += getWordCount(item.children);
      }
    }
  }
  return wordCount;
}

/**
 * @description - update index with chapter/verse/words for specified book code
 * @param {string} bookPath - path to books
 * @param {Object} index - data for index.json
 * @param {string} bookCode - book to index
 * @param {Boolean} isOL - if true then this is an Original Language
 */
function indexBook(bookPath, index, bookCode, isOL) {
  const expectedChapters = bible.BOOK_CHAPTER_VERSES[bookCode];
  if (!expectedChapters) {
    console.warn(errors.INVALID_BOOK_CODE + ': ' + bookCode);
    return;
  }
  const files = fs.readdirSync(bookPath);
  const chapterCount = Object.keys(expectedChapters).length;
  if (files.length !== chapterCount) {
    console.warn('Unexpected chapter count in \'' + bookCode + '\': Found ' + files.length + ' chapters, but expected ' + chapterCount);
  }
  const bookIndex = {};
  index[bookCode] = bookIndex;

  // add chapters
  for (const file of files) {
    const chapter = parseInt(file, 10);
    if (isNaN(chapter)) {
      continue;
    }
    const expectedVerses = expectedChapters[chapter];
    const expectedVerseCount = (expectedVerses && parseInt(expectedVerses, 10)) || 0;
    const chapterPath = path.join(bookPath, file);
    const ugntChapter = fs.readJSONSync(chapterPath);
    const ugntVerses = Object.keys(ugntChapter);
    const frontPos = ugntVerses.indexOf('front');
    if (frontPos >= 0) { // remove chapter front matter
      ugntVerses.splice(frontPos, 1); // remove front item
    }
    if (ugntVerses.length !== expectedVerseCount) {
      console.warn(`WARNING: ${bookCode} - in chapter ${chapter}, found ${ugntVerses.length} verses but should be ${expectedVerseCount} verses`);
    }

    if (isOL) { // if an OL, we need word counts of verses
      const chapterIndex = {};
      bookIndex[chapter] = chapterIndex;
      for (const verse of ugntVerses) {
        let words = ugntChapter[verse];
        if (words.verseObjects) { // check for new verse objects support
          words = words.verseObjects;
        }
        chapterIndex[verse] = getWordCount(words);
      }
    } else { // is not an OL, so we need verse count
      let highVerse = 0;
      Object.keys(ugntChapter).forEach((verseID) => {
        const verse = parseInt(verseID);
        if (verse > highVerse) { // get highest verse
          highVerse = verse;
        }
      });
      bookIndex[chapter] = highVerse;
    }
  }
  if (!isOL) { // is not an OL, so we add chapter count
    bookIndex.chapters = chapterCount;
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
    const tempPath = indexPath + '_temp';
    fs.moveSync(indexPath, tempPath);
    fs.removeSync(tempPath);
  }
  const indexStr = JSON.stringify(index, null, 2);
  fs.outputFileSync(indexPath, indexStr, 'UTF-8');
}
