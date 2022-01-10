/* eslint-disable curly */
import fs from 'fs-extra';
import path from 'path-extra';
import {isObject} from 'util';
import * as tsvparser from 'uw-tsv-parser';
// helpers
import * as resourcesHelpers from '../resourcesHelpers';
import {getResourceManifest} from '../resourcesHelpers';
// constants
import * as errors from '../../resources/errors';
import {DOOR43_CATALOG} from "../apiHelpers";
import {makeSureResourceUnzipped} from "../unzipFileHelpers";

/**
 * @description Processes the extracted files for translationWord to create the folder
 * structure and produce the index.js file for the language with the title of each article.
 * @param {Object} resource - Resource object
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * @param {String} outputPath - Path to place the processed resource files WIHTOUT the version in the path
 * @return {Boolean} true if success
 */
export function processTranslationWords(resource, sourcePath, outputPath) {
  if (!resource || !isObject(resource) || !resource.languageId || !resource.resourceId)
    throw Error(resourcesHelpers.formatError(resource, errors.RESOURCE_NOT_GIVEN));
  if (!sourcePath)
    throw Error(resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_GIVEN));
  if (!fs.pathExistsSync(sourcePath))
    throw Error(resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_EXIST));
  if (!outputPath)
    throw Error(resourcesHelpers.formatError(resource, errors.OUTPUT_PATH_NOT_GIVEN));
  if (fs.pathExistsSync(outputPath))
    fs.removeSync(outputPath);

  const door43 = resource.owner === DOOR43_CATALOG;
  const typesPath = path.join(sourcePath, 'bible');
  const isDirectory = (item) => fs.lstatSync(path.join(typesPath, item)).isDirectory();
  let typeDirs = [];
  if (fs.existsSync(typesPath)) {
    typeDirs = fs.readdirSync(typesPath).filter(isDirectory);
  }
  typeDirs.forEach((typeDir) => {
    const typePath = path.join(typesPath, typeDir);
    const files = fs.readdirSync(typePath).filter((filename) => path.extname(filename) === '.md');
    if (door43) { // if not in D43 catalog we will get generate index from twl
      generateGroupsIndex(typePath, outputPath, typeDir);
    }
    files.forEach((fileName) => {
      const sourcePath = path.join(typePath, fileName);
      const destinationPath = path.join(
        outputPath,
        typeDir,
        'articles',
        fileName,
      );
      fs.copySync(sourcePath, destinationPath);
    });
  });
  return true;
}

/**
 * convert line to object
 * @param {object} tableObject - from parser
 * @param {array} tsvLine
 * @return {{tsvObject: {}, length: *}}
 */
function tsvLineToObject(tableObject, tsvLine) {
  const tsvObject = {};
  const length = tableObject.header.length;
  for (let i = 0; i < length; i++) {
    const key = tableObject.header[i];
    const value = tsvLine[i];
    tsvObject[key] = value;
  }
  return {tsvObject, length};
}

/**
 * process the TSV file into index files
 * @param tsvPath
 * @param resourcesPath
 */
function generateIndexForTSV(tsvPath, project, resourcesPath) {
  const tsvLines = fs.readFileSync(tsvPath).toString();
  console.log(tsvLines);
  const tableObject = tsvparser.tsvStringToTable(tsvLines);
  if ( tableObject.errors.length > 0 ) {
    let results = '';
    const expectedColumns = tableObject.header.length;
    for (let i=0; i<tableObject.errors.length; i++) {
      let msg;
      const rownum = tableObject.errors[i][0] - 1; // adjust for data table without header row
      const colsfound = tableObject.errors[i][1];
      if ( colsfound > expectedColumns ) {
        msg = 'Row is too long';
      } else {
        msg = 'Row is too short';
      }
      results += `\n\n${msg}:`;
      results += '\n' + tableObject.data[rownum].join(',');
    }
    console.warn(`twArticleHelpers.generateIndexForTSV() - table parse errors found: ${results}`);
  }
  for (const tsvLine of tableObject.data) {
    let {tsvObject, length} = tsvLineToObject(tableObject, tsvLine);
    console.log(tsvObject);
  }
}

/**
 * @description Processes the extracted files for translationWord to create the folder
 * structure and produce the index.js file for the language with the title of each article.
 * @param {Object} resource - Resource object
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * @param {String} outputPath - Path to place the processed resource files WIHTOUT the version in the path
 * @return {Boolean} true if success
 */
export function processTranslationWordsTSV(resource, sourcePath, outputPath, resourcesPath) {
  if (!resource || !isObject(resource) || !resource.languageId || !resource.resourceId)
    throw Error(resourcesHelpers.formatError(resource, errors.RESOURCE_NOT_GIVEN));
  if (!sourcePath)
    throw Error(resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_GIVEN));
  if (!fs.pathExistsSync(sourcePath))
    throw Error(resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_EXIST));
  if (!outputPath)
    throw Error(resourcesHelpers.formatError(resource, errors.OUTPUT_PATH_NOT_GIVEN));
  if (fs.pathExistsSync(outputPath))
    fs.removeSync(outputPath);
  // let tsvFiles = [];
  // // const tsvSourcePath = path.join(sourcePath, `${resource.languageId}_${resource.resourceId}`);
  // if (fs.existsSync(sourcePath)) {
  //   tsvFiles = fs.readdirSync(sourcePath).filter((filename) => path.extname(filename) === '.tsv');
  // }
  //
  // if (!tsvFiles || !tsvFiles.length) {
  //   throw new Error(`processTranslationWordsTSV() - cannot find TSV files at ${sourcePath}`);
  // }

  // make sure tW is unzipped
  const twPath = path.join(
    resourcesPath,
    resource.languageId,
    'translationHelps/translationWords'
  );
  const twVersionPath = resourcesHelpers.getLatestVersionInPath(twPath, resource.owner);
  if (twVersionPath) {
    makeSureResourceUnzipped(twVersionPath);
  } else {
    throw new Error(`processTranslationWordsTSV() - cannot find tW at ${twPath} for ${resource.owner}`);
  }

  const manifest = getResourceManifest(sourcePath);
  if (!(manifest && Array.isArray(manifest.projects))) {
    throw new Error(`processTranslationWordsTSV() - no projects in manifest at ${twPath} for ${resource.owner}`);
  }

  manifest.projects.forEach((project) => {
    const tsvPath = path.join(sourcePath, project.path);
    generateIndexForTSV(tsvPath, project, resourcesPath);
    // generateGroupsIndex(typePath, outputPath, tsvFile);
  });
  return true;
}

/**
 * @description - Generates the groups index for the tw articles (both kt, other and names).
 * @param {String} filesPath - Path to all tw markdown artciles.
 * @param {String} twOutputPath Path to the resource location in the static folder.
 * @param {String} folderName article type. ex. kt or other.
 */
function generateGroupsIndex(filesPath, twOutputPath, folderName) {
  const groupsIndex = [];
  const groupIds = fs.readdirSync(filesPath).filter((filename) => {
    return filename.split('.').pop() === 'md';
  });
  groupIds.forEach((fileName) => {
    const groupObject = {};
    const filePath = path.join(filesPath, fileName);
    const articleFile = fs.readFileSync(filePath, 'utf8');
    const groupId = fileName.replace('.md', '');
    // get the article's first line and remove #'s and spaces from beginning/end
    const groupName = articleFile.split('\n')[0].replace(/(^\s*#\s*|\s*#\s*$)/gi, '');
    groupObject.id = groupId;
    groupObject.name = groupName;
    groupsIndex.push(groupObject);
  });
  groupsIndex.sort(compareByFirstUniqueWord);
  const groupsIndexOutputPath = path.join(
    twOutputPath,
    folderName,
    'index.json',
  );

  fs.outputJsonSync(groupsIndexOutputPath, groupsIndex, {spaces: 2});
}

/**
 * Splits the string into words delimited by commas and compares the first unique word
 * @param {String} a first string to be compared
 * @param {String} b second string to be compared
 * @return {int} comparison result
 */
function compareByFirstUniqueWord(a, b) {
  const aWords = a.name.toUpperCase().split(',');
  const bWords = b.name.toUpperCase().split(',');
  while (aWords.length || bWords.length) {
    if (!aWords.length)
      return -1;
    if (!bWords.length)
      return 1;
    const aWord = aWords.shift().trim();
    const bWord = bWords.shift().trim();
    if (aWord !== bWord)
      return (aWord < bWord ? -1 : 1);
  }
  return 0; // both lists are the same
}
