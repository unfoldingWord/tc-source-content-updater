import { isObject } from 'util';
import fs from 'fs-extra';
import path from 'path-extra';
import {
  tsvToGroupData,
  formatAndSaveGroupData,
  generateGroupsIndex,
  saveGroupsIndex,
  tnJsonToGroupData,
  parseReference,
} from 'tsv-groupdata-parser';
// helpers
import * as resourcesHelpers from '../resourcesHelpers';
import { downloadAndProcessResource } from '../resourcesDownloadHelpers';
import {
  delay, getQueryStringForBibleId, getQueryVariable,
} from '../utils';
// constants
import * as errors from '../../resources/errors';
import {
  OT_ORIG_LANG,
  NT_ORIG_LANG,
  OT_ORIG_LANG_BIBLE,
  NT_ORIG_LANG_BIBLE,
  BOOK_CHAPTER_VERSES,
  BIBLE_LIST_NT,
} from '../../resources/bible';
import { makeSureResourceUnzipped } from '../unzipFileHelpers';
import {
  DOOR43_CATALOG,
  downloadManifestData,
  formatVersionWithoutV,
  formatVersionWithV,
  getOwnerForOriginalLanguage,
} from '../apiHelpers';
import { tsvToObjects } from './twArticleHelpers';

/**
 * search to see if we need to get any missing resources needed for tN processing
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * e.g. /Users/mannycolon/translationCore/resources/imports/en_tn_v16/en_tn
 * @param {String} resourcesPath Path to resources folder
 * @param {Function} getMissingOriginalResource - function called to fetch missing resources
 * @param {Array} downloadErrors - parsed list of download errors with details such as if the download completed (vs. parsing error), error, and url
 * @param {String} languageId - language ID for tA
 * @param {String} ownerStr
 * @param {boolean} needTa - set to false if resource does not depend on TA
 * @return {Promise<{otQuery: string, ntQuery: string}>}
 */
export async function getMissingResources(sourcePath, resourcesPath, getMissingOriginalResource, downloadErrors, languageId, ownerStr, needTa = true) {
  const tsvManifest = resourcesHelpers.getResourceManifestFromYaml(sourcePath);
  // array of related resources used to generated the tsv.
  const tsvRelations = tsvManifest.dublin_core.relation;
  const OT_ORIG_LANG_QUERY = getQueryStringForBibleId(tsvRelations, OT_ORIG_LANG);
  const otQuery = getQueryVariable(OT_ORIG_LANG_QUERY, 'v');
  const NT_ORIG_LANG_QUERY = getQueryStringForBibleId(tsvRelations, NT_ORIG_LANG);
  const ntQuery = getQueryVariable(NT_ORIG_LANG_QUERY, 'v');

  for (const isNewTestament of [false, true]) {
    const query = isNewTestament ? ntQuery : otQuery;

    if (query) {
      const origLangVersion = formatVersionWithV(query);
      const origLangId = isNewTestament ? NT_ORIG_LANG : OT_ORIG_LANG;
      const origLangBibleId = isNewTestament ? NT_ORIG_LANG_BIBLE: OT_ORIG_LANG_BIBLE;
      const originalLanguageOwner = getOwnerForOriginalLanguage(ownerStr);
      await getMissingOriginalResource(resourcesPath, origLangId, origLangBibleId, origLangVersion, downloadErrors, originalLanguageOwner);
      const originalBiblePath = path.join(
        resourcesPath,
        origLangId,
        'bibles',
        origLangBibleId,
        resourcesHelpers.addOwnerToKey(origLangVersion, originalLanguageOwner),
      );
      makeSureResourceUnzipped(originalBiblePath);
    }
  }

  await delay(500);

  if (needTa) {
    // make sure tA is unzipped
    const tAPath = path.join(
      resourcesPath,
      languageId,
      'translationHelps/translationAcademy'
    );
    const taVersionPath = resourcesHelpers.getLatestVersionInPath(tAPath, ownerStr, true);

    if (taVersionPath) {
      makeSureResourceUnzipped(taVersionPath);
    } else {
      const resource = `${ownerStr}/${languageId}_ta`;
      throw new Error(`tnArticleHelpers.getMissingResources() - cannot find '${resource}', at ${tAPath} for ${ownerStr}`);
    }
  }

  return { otQuery, ntQuery };
}

/**
 * process the 7 column tsv into group data
 * @param {string} filepath path to tsv file.
 * @param {string} bookId
 * @param {string} resourcesPath path to the resources dir
 * e.g. /User/john/translationCore/resources
 * @param {string} langId
 * @param {string} toolName tC tool name.
 * @param {string} originalBiblePath path to original bible.
 * e.g. /resources/el-x-koine/bibles/ugnt/v0.11
 * @param {object} params When it includes { categorized: true }
 * then it returns the object organized by tn article category.
 * @return {Promise<{tsvItems, groupData: string}>}
 */
async function tsvToGroupData7Cols(filepath, bookId, resourcesPath, langId, toolName, originalBiblePath, params) {
  const {
    tsvItems,
    error,
  } = await tsvToObjects(filepath, {});

  if (error) {
    throw error;
  }

  // convert 7 column TSV format to tsvObject format
  const tsvObjects = [];

  for (const tsvItem of tsvItems) {
    const reference = tsvItem && tsvItem.Reference;

    if (reference) {
      tsvItem.OrigQuote = tsvItem.Quote;
      tsvItem.OccurrenceNote = tsvItem.Note;
      tsvItem.Book = bookId;
      const refParts = parseReference(reference, true);

      for (const part of refParts) {
        const tsvObject = {
          ...tsvItem,
          Chapter: part.chapter,
          Verse: part.verse,
        };
        tsvObjects.push(tsvObject);
      }
    }
  }

  try {
    const groupData = tnJsonToGroupData(originalBiblePath, bookId, tsvObjects, resourcesPath, langId, toolName, params, filepath);
    return groupData;
  } catch (e) {
    console.error(`tsvToGroupData7Cols() - error processing filepath: ${filepath}`, e);
    throw e;
  }
}

/**
 * @description Processes the extracted files for translationNotes to separate the folder
 * structure and produce the index.json file for the language with the title of each article.
 * @param {Object} resource - Resource object
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * e.g. /Users/mannycolon/translationCore/resources/imports/en_tn_v16/en_tn
 * @param {String} outputPath - Path to place the processed resource files WITHOUT the version in the path
 * @param {String} resourcesPath Path to resources folder
 * @param {Array} downloadErrors - parsed list of download errors with details such as if the download completed (vs. parsing error), error, and url
 */
export async function processTranslationNotes(resource, sourcePath, outputPath, resourcesPath, downloadErrors) {
  try {
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

    const translationAcademyPath = path.join(
      resourcesPath,
      resource.languageId,
      'translationHelps',
      'translationAcademy'
    );
    let taCategoriesPath = resourcesHelpers.getLatestVersionInPath(translationAcademyPath, resource.owner);

    if (!taCategoriesPath) {
      console.log(`tnArticleHelpers.processTranslationNotes() - download missing tA resource`);
      await getMissingHelpsResource(resourcesPath, resource, 'ta', 'Translation_Academy', downloadErrors);
      console.log(`tnArticleHelpers.processTranslationNotes() - have tA resource`);
      taCategoriesPath = resourcesHelpers.getLatestVersionInPath(translationAcademyPath, resource.owner);
    }

    const originalLanguageOwner = getOwnerForOriginalLanguage(resource.owner);
    const { otQuery, ntQuery } = await getMissingResources(sourcePath, resourcesPath, getMissingOriginalResource, downloadErrors, resource.languageId, resource.owner);
    console.log(`tnArticleHelpers.processTranslationNotes() - have needed original bibles for ${sourcePath}, starting processing`);
    const tsvFiles = fs.readdirSync(sourcePath).filter((filename) => path.extname(filename) === '.tsv');
    const tnErrors = [];

    for (const filename of tsvFiles) {
      try {
        const isSevenCol = (filename.toLowerCase().indexOf('tn_') === 0); // file names are as tn_2JN.tsv
        const splitter = isSevenCol ? '_' : '-';
        const bookId = filename.split(splitter)[1].toLowerCase().replace('.tsv', '');

        if (!BOOK_CHAPTER_VERSES[bookId]) {
          console.error(`tnArticleHelpers.processTranslationNotes() - ${bookId} is not a valid book id.`);
        }

        let isNewTestament = true;

        if (isSevenCol) {
          isNewTestament = BIBLE_LIST_NT.find(bookNumberAndId => (bookNumberAndId.split('-')[1].toLowerCase() === bookId));
        } else {
          const bookNumberAndIdMatch = filename.match(/(\d{2}-\w{3})/ig) || [];
          const bookNumberAndId = bookNumberAndIdMatch[0];
          isNewTestament = BIBLE_LIST_NT.includes(bookNumberAndId);
        }

        const originalLanguageId = isNewTestament ? NT_ORIG_LANG : OT_ORIG_LANG;
        const originalLanguageBibleId = isNewTestament ? NT_ORIG_LANG_BIBLE : OT_ORIG_LANG_BIBLE;
        const version = isNewTestament && ntQuery ? ('v' + ntQuery) : otQuery ? ('v' + otQuery) : null;

        if (!version) {
          console.warn('tnArticleHelpers.processTranslationNotes() - There was a missing version for book ' + bookId + ' of resource ' + originalLanguageBibleId + ' from ' + resource.downloadUrl);
          return;
        }

        const originalBiblePath = path.join(
          resourcesPath,
          originalLanguageId,
          'bibles',
          originalLanguageBibleId,
          `${version}_${originalLanguageOwner}`
        );

        if (fs.existsSync(originalBiblePath)) {
          const filepath = path.join(sourcePath, filename);
          let groupData;
          const params = { categorized: true };
          const toolName = 'translationNotes';

          if (isSevenCol) {
            groupData = await tsvToGroupData7Cols(filepath, bookId, resourcesPath, resource.languageId, toolName, originalBiblePath, params);
          } else {
            groupData = await tsvToGroupData(filepath, toolName, params, originalBiblePath, resourcesPath, resource.languageId);
          }
          await formatAndSaveGroupData(groupData, outputPath, bookId);
        } else {
          const resource = `${originalLanguageOwner}/${originalLanguageId}_${originalLanguageBibleId}`;
          const message = `tnArticleHelpers.processTranslationNotes() - cannot find '${resource}' at ${originalBiblePath}:`;
          console.error(message);
          tnErrors.push(message);
        }
      } catch (e) {
        const message = `tnArticleHelpers.processTranslationNotes() - error processing ${filename}:`;
        console.error(message, e);
        tnErrors.push(message + e.toString());
      }
    }

    await delay(200);

    if (tnErrors.length) { // report errors
      const message = `tnArticleHelpers.processTranslationNotes() - error processing ${sourcePath}`;
      console.error(message);
      throw new Error(`${message}:\n${tnErrors.join('\n')}`);
    }

    // Generate groupsIndex using tN groupData & tA articles.
    makeSureResourceUnzipped(taCategoriesPath);
    const categorizedGroupsIndex = generateGroupsIndex(outputPath, taCategoriesPath);
    saveGroupsIndex(categorizedGroupsIndex, outputPath);
  } catch (error) {
    console.error('tnArticleHelpers.processTranslationNotes() - error:', error);
    throw error;
  }
}

/**
 * Get missing original language resource
 * @param {String} resourcesPath - resources Path
 * @param {String} originalLanguageId - original language Id
 * @param {String} originalLanguageBibleId - original language bible Id
 * @param {String} version - version number
 * @param {Array} downloadErrors - parsed list of download errors with details such as if the download completed (vs. parsing error), error, and url
 * @param {String} ownerStr
 * @return {Promise}
 */
export function getMissingOriginalResource(resourcesPath, originalLanguageId, originalLanguageBibleId, version, downloadErrors, ownerStr) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const version_ = formatVersionWithV(version);
      const originalBiblePath = path.join(
        resourcesPath,
        originalLanguageId,
        'bibles',
        originalLanguageBibleId,
        `${version_}_${ownerStr}`
      );

      // If version needed is not in the resources download it.
      if (!fs.existsSync(originalBiblePath)) {
        const resourceName = `${originalLanguageId}_${originalLanguageBibleId}`;
        let downloadUrl;

        if (ownerStr === DOOR43_CATALOG) {
          // Download orig. lang. resource
          downloadUrl = `https://cdn.door43.org/${originalLanguageId}/${originalLanguageBibleId}/${version_}/${originalLanguageBibleId}.zip`;
        } else { // otherwise we read from uW org
          // Download orig. lang. resource
          downloadUrl = `https://git.door43.org/unfoldingWord/${resourceName}/archive/${version_}.zip`;
        }
        console.log(`tnArticleHelpers.getMissingOriginalResource() - downloading missing original bible: ${downloadUrl}`);
        const resource = {
          languageId: originalLanguageId,
          resourceId: originalLanguageBibleId,
          remoteModifiedTime: '0001-01-01T00:00:00+00:00',
          downloadUrl,
          name: resourceName,
          version: formatVersionWithoutV(version),
          subject: 'Bible',
          owner: ownerStr,
          catalogEntry: {
            subject: {},
            resource: {},
            format: {},
          },
        };
        // Delay to try to avoid Socket timeout
        await delay(1000);
        await downloadAndProcessResource(resource, resourcesPath, downloadErrors);
        resolve();
      } else {
        resolve();
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * download a missing missing resource that matches parentResource, but has fetchResourceId
 * @param {String} resourcesPath - resources Path
 * @param {object} parentResource - resource of object loading this as a dependency
 * @param {String} fetchResourceId - id of resource to fetch, such as 'ta'
 * @param {String} fetchSubject - subject string of resource to fetch, such as 'Translation_Academy'
 * @param {Array} downloadErrors - parsed list of download errors with details such as if the download completed (vs. parsing error), error, and url
 * @return {Promise}
 */
export function getMissingHelpsResource(resourcesPath, parentResource, fetchResourceId, fetchSubject, downloadErrors) {
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const resourceName = `${parentResource.languageId}_${fetchResourceId}`;
      // get latest version
      const manifest = await downloadManifestData(parentResource.owner, resourceName);
      const version = manifest && manifest.dublin_core && manifest.dublin_core.version || 'master';
      const version_ = formatVersionWithV(version);

      const downloadUrl = `https://git.door43.org/${parentResource.owner}/${resourceName}/archive/${version_}.zip`;
      console.log(`tnArticleHelpers.getMissingHelpsResource() - downloading missing helps: ${downloadUrl}`);
      const resource = {
        languageId: parentResource.languageId,
        resourceId: fetchResourceId,
        remoteModifiedTime: '0001-01-01T00:00:00+00:00',
        downloadUrl,
        name: resourceName,
        owner: parentResource.owner,
        version: formatVersionWithoutV(version),
        subject: fetchSubject,
      };
      // Delay to try to avoid Socket timeout
      await delay(1000);
      await downloadAndProcessResource(resource, resourcesPath, downloadErrors);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get the version of the other Tns orginal language.
 * @param {String} resourcesPath - resources Path
 * @param {string} originalLanguageId - original Language Id.
 * @return {array}
 */
export function getOtherTnsOLVersions(resourcesPath, originalLanguageId) {
  const languageIds = fs.readdirSync(resourcesPath)
    .filter((filename) => resourcesHelpers.isDirectory(resourcesPath, filename));
  const versionsToNotDelete = [];

  languageIds.forEach((languageId) => {
    const tnHelpsPath = path.join(resourcesPath, languageId, 'translationHelps', 'translationNotes');

    if (fs.existsSync(tnHelpsPath)) {
      const owners = resourcesHelpers.getLatestVersionsAndOwners(tnHelpsPath) || {};

      for (const owner of Object.keys(owners)) {
        const tnHelpsVersionPath = owners[owner];

        if (tnHelpsVersionPath) {
          const tnManifestPath = path.join(tnHelpsVersionPath, 'manifest.json');

          if (fs.existsSync(tnManifestPath)) {
            const manifest = fs.readJsonSync(tnManifestPath);
            const { relation } = manifest.dublin_core || {};
            const query = getQueryStringForBibleId(relation, originalLanguageId);

            if (query) {
              const version = 'v' + getQueryVariable(query, 'v');
              // console.log(`tnArticleHelpers.getOtherTnsOLVersions() - for ${languageId}, found dependency: ${query}`);
              versionsToNotDelete.push(version);
            }
          }
        }
      }
    }
  });

  return versionsToNotDelete;
}
