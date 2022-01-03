import fs from 'fs-extra';
import path from 'path-extra';
import {isObject} from 'util';
import {
  tsvToGroupData,
  formatAndSaveGroupData,
  generateGroupsIndex,
  saveGroupsIndex,
} from 'tsv-groupdata-parser';
// helpers
import * as resourcesHelpers from '../resourcesHelpers';
import {downloadAndProcessResource} from '../resourcesDownloadHelpers';
import {delay, getQueryStringForBibleId, getQueryVariable} from '../utils';
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
import {makeSureResourceUnzipped} from '../unzipFileHelpers';

/**
 * search to see if we need to get any missing resources needed for tN processing
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * e.g. /Users/mannycolon/translationCore/resources/imports/en_tn_v16/en_tn
 * @param {String} resourcesPath Path to resources folder
 * @param {Function} getMissingOriginalResource - function called to fetch missing resources
 * @param {Array} downloadErrors - parsed list of download errors with details such as if the download completed (vs. parsing error), error, and url
 * @param {String} languageId - language ID for tA
 * @return {Promise<{otQuery: string, ntQuery: string}>}
 */
export async function getMissingResources(sourcePath, resourcesPath, getMissingOriginalResource, downloadErrors, languageId) {
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
      const origLangVersion = 'v' + query;
      const origLangId = isNewTestament ? NT_ORIG_LANG : OT_ORIG_LANG;
      const origLangBibleId = isNewTestament ? NT_ORIG_LANG_BIBLE: OT_ORIG_LANG_BIBLE;
      await getMissingOriginalResource(resourcesPath, origLangId, origLangBibleId, origLangVersion, downloadErrors);
      const originalBiblePath = path.join(
        resourcesPath,
        origLangId,
        'bibles',
        origLangBibleId,
        origLangVersion
      );
      makeSureResourceUnzipped(originalBiblePath);
    }
  }

  // make sure tA is unzipped
  const tAPath = path.join(
    resourcesPath,
    languageId,
    'translationHelps/translationAcademy'
  );
  const taVersionPath = resourcesHelpers.getLatestVersionInPath(tAPath);
  if (taVersionPath) {
    makeSureResourceUnzipped(taVersionPath);
  } else {
    throw new Error(`getMissingResources() - cannot find tA at ${tAPath}`);
  }
  return {otQuery, ntQuery};
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

    const {otQuery, ntQuery} = await getMissingResources(sourcePath, resourcesPath, getMissingOriginalResource, downloadErrors, resource.languageId);
    console.log(`processTranslationNotes() - have needed original bibles for ${sourcePath}, starting processing`);
    const tsvFiles = fs.readdirSync(sourcePath).filter((filename) => path.extname(filename) === '.tsv');
    const tnErrors = [];

    for (const filename of tsvFiles) {
      try {
        const bookId = filename.split('-')[1].toLowerCase().replace('.tsv', '');
        if (!BOOK_CHAPTER_VERSES[bookId]) console.error(`${bookId} is not a valid book id.`);
        const bookNumberAndIdMatch = filename.match(/(\d{2}-\w{3})/ig) || [];
        const bookNumberAndId = bookNumberAndIdMatch[0];
        const isNewTestament = BIBLE_LIST_NT.includes(bookNumberAndId);
        const originalLanguageId = isNewTestament ? NT_ORIG_LANG : OT_ORIG_LANG;
        const originalLanguageBibleId = isNewTestament ? NT_ORIG_LANG_BIBLE : OT_ORIG_LANG_BIBLE;
        const version = isNewTestament && ntQuery ? ('v' + ntQuery) : otQuery ? ('v' + otQuery) : null;
        if (!version) {
          console.warn('There was a missing version for book ' + bookId + ' of resource ' + originalLanguageBibleId + ' from ' + resource.downloadUrl);
          return;
        }
        const originalBiblePath = path.join(
          resourcesPath,
          originalLanguageId,
          'bibles',
          originalLanguageBibleId,
          version
        );
        if (fs.existsSync(originalBiblePath)) {
          const filepath = path.join(sourcePath, filename);
          const groupData = await tsvToGroupData(filepath, 'translationNotes', {categorized: true}, originalBiblePath, resourcesPath, resource.languageId);
          await formatAndSaveGroupData(groupData, outputPath, bookId);
        } else {
          const message = `processTranslationNotes() - cannot find original bible ${originalBiblePath}:`;
          console.error(message);
          tnErrors.push(message);
        }
      } catch (e) {
        const message = `processTranslationNotes() - error processing ${filename}:`;
        console.error(message, e);
        tnErrors.push(message + e.toString());
      }
    }

    await delay(200);

    if (tnErrors.length) { // report errors
      const message = `processTranslationNotes() - error processing ${sourcePath}`;
      console.error(message);
      throw new Error(`${message}:\n${tnErrors.join('\n')}`);
    }

    // Generate groupsIndex using tN groupData & tA articles.
    const translationAcademyPath = path.join(
      resourcesPath,
      resource.languageId,
      'translationHelps',
      'translationAcademy'
    );

    const taCategoriesPath = resourcesHelpers.getLatestVersionInPath(translationAcademyPath);
    makeSureResourceUnzipped(taCategoriesPath);
    const categorizedGroupsIndex = generateGroupsIndex(outputPath, taCategoriesPath);
    saveGroupsIndex(categorizedGroupsIndex, outputPath);
  } catch (error) {
    console.error('processTranslationNotes() - error:', error);
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
 * @return {Promise}
 */
function getMissingOriginalResource(resourcesPath, originalLanguageId, originalLanguageBibleId, version, downloadErrors) {
  return new Promise(async (resolve, reject) => {
    try {
      const originalBiblePath = path.join(
        resourcesPath,
        originalLanguageId,
        'bibles',
        originalLanguageBibleId,
        version
      );

      if (!fs.existsSync(originalBiblePath)) {
        // Download orig. lang. resource
        const downloadUrl = `https://cdn.door43.org/${originalLanguageId}/${originalLanguageBibleId}/${version}/${originalLanguageBibleId}.zip`;
        console.log(`getMissingOriginalResource() - downloading missing original bible: ${downloadUrl}`);
        const resource = {
          languageId: originalLanguageId,
          resourceId: originalLanguageBibleId,
          remoteModifiedTime: '0001-01-01T00:00:00+00:00',
          downloadUrl,
          version: version.replace('v', ''),
          subject: 'Bible',
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
      const tnHelpsVersionPath = resourcesHelpers.getLatestVersionInPath(tnHelpsPath);
      if (tnHelpsVersionPath) {
        const tnManifestPath = path.join(tnHelpsVersionPath, 'manifest.json');
        if (fs.existsSync(tnManifestPath)) {
          const manifest = fs.readJsonSync(tnManifestPath);
          const {relation} = manifest.dublin_core || {};
          const query = getQueryStringForBibleId(relation, originalLanguageId);
          if (query) {
            const version = 'v' + getQueryVariable(query, 'v');
            versionsToNotDelete.push(version);
          }
        }
      }
    }
  });

  return versionsToNotDelete;
}
