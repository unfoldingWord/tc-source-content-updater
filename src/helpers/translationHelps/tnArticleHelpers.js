import fs from 'fs-extra';
import path from 'path-extra';
import {isObject} from 'util';
import tsvParser from 'tsv-groupdata-parser';
// helpers
import * as resourcesHelpers from '../resourcesHelpers';
// constants
import * as errors from '../../resources/errors';
import * as bibleUtils from '../../resources/bible';

/**
 * @description Processes the extracted files for translationNotes to separate the folder
 * structure and produce the index.js file for the language with the title of each article.
 * @param {Object} resource - Resource object
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * @param {String} outputPath - Path to place the processed resource files WIHTOUT the version in the path
 */
export function processTranslationNotes(resource, sourcePath, outputPath) {
  if (!resource || !isObject(resource) || !resource.languageId || !resource.resourceId) {
    throw Error(resourcesHelpers.formatError(resource, errors.RESOURCE_NOT_GIVEN));
  }
  if (!sourcePath) {
    throw Error(resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_GIVEN));
  }
  if (!fs.pathExistsSync(sourcePath)) {
    throw Error(resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_EXIST));
  }
  if (!outputPath) {
    throw Error(resourcesHelpers.formatError(resource, errors.OUTPUT_PATH_NOT_GIVEN));
  }
  if (fs.pathExistsSync(outputPath)) {
    fs.removeSync(outputPath);
  }

  const tsvFiles = fs.readdirSync(sourcePath).filter((filename) => path.extname(filename) === '.tsv');

  tsvFiles.forEach(async(fileName) => {
    const filepath = path.join(sourcePath, fileName);
    const bookId = fileName.split('-')[1].toLowerCase();

    if (!bibleUtils.BOOK_CHAPTER_VERSES[bookId]) {
      console.error(`${bookId} is not a valid book id.`);
    }

    console.log(filepath);

    const groupData = await tsvParser.tsvToGroupData(filepath, 'translationNotes');
    const categorizeGroupData = tsvParser.categorizeGroupData(groupData);

    tsvParser.formatAndSaveGroupData(categorizeGroupData, outputPath, bookId);
  });
}
