/* eslint-disable curly */
import fs from 'fs-extra';
import path from 'path-extra';
import {isObject} from 'util';
import {
  formatAndSaveGroupData,
  generateGroupDataItem,
  ManageResource,
  parseReference,
  tsvToObjects,
} from 'tsv-groupdata-parser';
// helpers
import * as resourcesHelpers from '../resourcesHelpers';
// eslint-disable-next-line no-duplicate-imports
import {getResourceManifest} from '../resourcesHelpers';
// constants
import * as errors from '../../resources/errors';
import {getOwnerForOriginalLanguage} from '../apiHelpers';
import {makeSureResourceUnzipped} from '../unzipFileHelpers';
import {BIBLE_BOOKS, NT_ORIG_LANG, NT_ORIG_LANG_BIBLE, OT_ORIG_LANG, OT_ORIG_LANG_BIBLE} from '../../resources/bible';
import {
  convertEllipsisToAmpersand,
  getMissingOriginalResource,
  getMissingResources,
} from './tnArticleHelpers';
import {delay} from '../utils';

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

  const typesPath = path.join(sourcePath, 'bible');
  const isDirectory = (item) => fs.lstatSync(path.join(typesPath, item)).isDirectory();
  let typeDirs = [];
  if (fs.existsSync(typesPath)) {
    typeDirs = fs.readdirSync(typesPath).filter(isDirectory);
  }
  typeDirs.forEach((typeDir) => {
    const typePath = path.join(typesPath, typeDir);
    const files = fs.readdirSync(typePath).filter((filename) => path.extname(filename) === '.md');
    generateGroupsIndex(typePath, outputPath, typeDir);
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
 * organize group data by catalogories and groupID
 * @param {array} groupData
 * @return {Object}
 */
const categorizeGroupData = groupData => {
  const categorizedGroupData = {
    kt: {},
    names: {},
    other: {},
  };
  Object.keys(groupData).forEach(category_ => {
    let category = category_;
    const items = groupData[category];
    if (!categorizedGroupData[category]) {
      category = 'other'; // unknown categories go in other
    }
    for (const item of items) {
      const groupId = item.contextId && item.contextId.groupId;
      if (groupId) {
        if (!categorizedGroupData[category][groupId]) {
          categorizedGroupData[category][groupId] = [];
        }
        categorizedGroupData[category][groupId].push(item);
      }
    }
  });
  return categorizedGroupData;
};

/**
 * Parses list of tsv items and returns an object holding the lists of group ids.
 * @param {Array} tsvItems - list of items to process
 * @param {string} originalBiblePath path to original bible.
 *        e.g. /resources/el-x-koine/bibles/ugnt/v0.11
 * @param {string} resourcesPath path to the resources dir
 *      e.g. /User/john/translationCore/resources
 * @param {string} bookId
 * @param {string} langId
 * @param {string} toolName tC tool name.
 * @param {object} params When it includes { categorized: true }
 *      then it returns the object organized by tn article category.
 * @return {Object} - groupData
 */
function tsvObjectsToGroupData(tsvItems, originalBiblePath, resourcesPath, bookId, langId, toolName, params) {
  const groupData = {};
  const twLinkMatch = /^rc:\/\/\*\/tw\/dict\/bible\/(\w+)\/([\w\d]+)/;
  const twLinkRE = new RegExp(twLinkMatch);
  bookId = bookId.toLowerCase();

  try {
    const resourceApi = new ManageResource(originalBiblePath, bookId);

    for (const tsvItem of tsvItems) {
      if (tsvItem.Reference && tsvItem.ID && tsvItem.OrigWords && tsvItem.Occurrence && tsvItem.TWLink) {
//        const tags = cleanGroupId(tsvItem.Tags) || 'other';
        const twLink = tsvItem.TWLink.match(twLinkRE);
        if (!twLink) {
          console.warn(`tsvObjectsToGroupData() - invalid TWLink: ${tsvItem.TWLink}`);
          continue;
        }

        const chapter = tsvItem.Chapter;
        const verse = tsvItem.Verse;
        tsvItem.Book = bookId;
        tsvItem.Chapter = chapter;
        tsvItem.Verse = verse;
        tsvItem.OrigQuote = tsvItem.OrigWords;
        tsvItem.Catagory = twLink[1];
        tsvItem.SupportReference = twLink[2];
        let verseString = null;

        if (!tsvItem.Catagory || !tsvItem.SupportReference) {
          console.warn(`tsvObjectsToGroupData() - invalid TWLink: ${tsvItem.TWLink}`);
          continue;
        }

        try {
          verseString = resourceApi.getVerseStringFromRef(tsvItem.Reference);
        } catch (e) {
          if (parseInt(chapter, 10) && parseInt(verse, 10)) {
            console.warn(`tsvObjectsToGroupData() - error getting verse string: chapter ${chapter}, verse ${verse} from ${JSON.stringify(tsvItem)}`, e);
          }
        }

        if (verseString) {
          const key = tsvItem.Catagory;
          const groupDataItem = generateGroupDataItem(tsvItem, toolName, verseString);
          if (groupData[key]) {
            groupData[key].push(groupDataItem);
          } else {
            groupData[key] = [groupDataItem];
          }
        }
      } else {
        console.warn('tsvObjectsToGroupData() - error processing item:', JSON.stringify(tsvItem));
      }
    }

    return params && params.categorized ? categorizeGroupData(groupData) : groupData;
  } catch (e) {
    console.error(`tsvObjectsToGroupData() - error processing TSVs`, e);
    throw e;
  }
}

/**
 * process the TSV file into index files
 * @param {string} tsvPath
 * @param {object} project
 * @param {string} resourcesPath
 * @param {string} originalBiblePath
 * @param {string} outputPath
 */
export async function twlTsvToGroupData(tsvPath, project, resourcesPath, originalBiblePath, outputPath) {
  const bookId = project.identifier;
  let groupData;
  const {
    tsvItems,
    error,
  } = await tsvToObjects(tsvPath, project);

  if (error) {
    throw error;
  }

  const tsvItems_ = [];
  for (const tsvItem of tsvItems) {
    const cleanedRef = parseReference(tsvItem.Reference);
    const tsvItem_ = {
      ...tsvItem,
      ...cleanedRef,
    };
    tsvItems_.push(tsvItem_);
  }

  try {
    groupData = tsvObjectsToGroupData(tsvItems_, originalBiblePath, resourcesPath, bookId, project.languageId, 'translationWords', {categorized: true});
    convertEllipsisToAmpersand(groupData, tsvPath);
    await formatAndSaveGroupData(groupData, outputPath, bookId);
  } catch (e) {
    console.error(`twArticleHelpers.twlTsvToGroupData() - error processing filepath: ${tsvPath}`, e);
    throw e;
  }
  return groupData;
}

/**
 * @description Processes the extracted files for translationWord to create the folder
 * structure and produce the index.js file for the language with the title of each article.
 * @param {Object} resource - Resource object
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * @param {String} outputPath - Path to place the processed resource files WIHTOUT the version in the path
 * @param {string} resourcesPath
 * @param {Array} downloadErrors - parsed list of download errors with details such as if the download completed (vs. parsing error), error, and url
 * @param {object} config - configuration object
 * @return {Boolean} true if success
 */
export async function processTranslationWordsTSV(resource, sourcePath, outputPath, resourcesPath, downloadErrors, config = {}) {
  try {
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

    const {otQuery, ntQuery} = await getMissingResources(sourcePath, resourcesPath, getMissingOriginalResource, downloadErrors, resource.languageId, resource.owner, false, config);

    // make sure tW is already installed
    const twPath = path.join(
      resourcesPath,
      resource.languageId,
      'translationHelps/translationWords'
    );
    const twVersionPath = resourcesHelpers.getLatestVersionInPath(twPath, resource.owner);
    if (fs.existsSync(twVersionPath)) {
      makeSureResourceUnzipped(twVersionPath);
    } else {
      const resource_ = `${resource.owner}/${resource.languageId}_tw`;
      throw new Error(`processTranslationWordsTSV() - cannot find '${resource_}' at ${twPath} for ${resource.owner}`);
    }

    const manifest = getResourceManifest(sourcePath);
    if (!(manifest && Array.isArray(manifest.projects))) {
      throw new Error(`processTranslationWordsTSV() - no projects in manifest at ${sourcePath} for ${resource.owner}`);
    }

    const twlErrors = [];

    for (const project of manifest.projects) {
      const tsvPath = path.join(sourcePath, project.path);
      try {
        const bookId = project.identifier;
        const isNewTestament = BIBLE_BOOKS.newTestament[project.identifier];
        const originalLanguageId = isNewTestament ? NT_ORIG_LANG : OT_ORIG_LANG;
        const originalLanguageBibleId = isNewTestament ? NT_ORIG_LANG_BIBLE : OT_ORIG_LANG_BIBLE;
        const version = isNewTestament && ntQuery ? ('v' + ntQuery) : otQuery ? ('v' + otQuery) : null;
        if (!version) {
          console.warn('processTranslationWordsTSV() - There was a missing version for book ' + bookId + ' of resource ' + originalLanguageBibleId + ' from ' + resource.downloadUrl);
          continue;
        }
        const originalLanguageOwner = getOwnerForOriginalLanguage(resource.owner);
        const originalBiblePath = path.join(
          resourcesPath,
          originalLanguageId,
          'bibles',
          originalLanguageBibleId,
          `${version}_${originalLanguageOwner}`
        );

        if (!fs.existsSync(tsvPath)) {
          const message = `processTranslationWordsTSV() - cannot find '${tsvPath}' from manifest projects - skipping`;
          console.warn(message);
        } else
        if (fs.existsSync(originalBiblePath)) {
          const groupData = await twlTsvToGroupData(tsvPath, project, resourcesPath, originalBiblePath, outputPath);
          convertEllipsisToAmpersand(groupData, tsvPath);
          await formatAndSaveGroupData(groupData, outputPath, bookId);
        } else {
          const resource = `${originalLanguageOwner}/${originalLanguageId}_${originalLanguageBibleId}`;
          const message = `processTranslationWordsTSV() - cannot find '${resource}' at ${originalBiblePath}:`;
          console.error(message);
          twlErrors.push(message);
        }
      } catch (e) {
        const message = `processTranslationWordsTSV() - error processing ${tsvPath}:`;
        console.error(message, e);
        twlErrors.push(message + e.toString());
      }
    }

    await delay(200);

    if (twlErrors.length) { // report errors
      const message = `processTranslationWordsTSV() - error processing ${sourcePath}`;
      console.error(message);
      throw new Error(`${message}:\n${twlErrors.join('\n')}`);
    }
  } catch (error) {
    console.error('processTranslationWordsTSV() - error:', error);
    throw error;
  }
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
