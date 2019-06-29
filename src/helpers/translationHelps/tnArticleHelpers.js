import fs from 'fs-extra';
import path from 'path-extra';
import {isObject} from 'util';
import ospath from 'ospath';
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

/**
 * @description Processes the extracted files for translationNotes to separate the folder
 * structure and produce the index.js file for the language with the title of each article.
 * @param {Object} resource - Resource object
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * e.g. /Users/mannycolon/translationCore/resources/imports/en_tn_v16/en_tn
 * @param {String} outputPath - Path to place the processed resource files WITHOUT the version in the path
 * @param {String} resourcesPath Path to user resources folder
 */
export async function processTranslationNotes(resource, sourcePath, outputPath, resourcesPath) {
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

    const tsvManifest = resourcesHelpers.getResourceManifestFromYaml(sourcePath);
    // array of related resources used to generated the tsv.
    const tsvRelations = tsvManifest.dublin_core.relation;
    const OT_ORIG_LANG_QUERY = getQueryStringForBibleId(tsvRelations, OT_ORIG_LANG);
    const NT_ORIG_LANG_QUERY = getQueryStringForBibleId(tsvRelations, NT_ORIG_LANG);
    const OT_ORIG_LANG_VERSION = 'v' + getQueryVariable(OT_ORIG_LANG_QUERY, 'v');
    const NT_ORIG_LANG_VERSION = 'v' + 0.7;
    // getQueryVariable(NT_ORIG_LANG_QUERY, 'v');
    await getMissingOriginalResource(resourcesPath, OT_ORIG_LANG, OT_ORIG_LANG_BIBLE, OT_ORIG_LANG_VERSION);
    await getMissingOriginalResource(resourcesPath, NT_ORIG_LANG, NT_ORIG_LANG_BIBLE, NT_ORIG_LANG_VERSION);
    const tsvFiles = fs.readdirSync(sourcePath).filter((filename) => path.extname(filename) === '.tsv');

    tsvFiles.forEach(async(filename) => {
      const bookId = filename.split('-')[1].toLowerCase().replace('.tsv', '');
      if (!BOOK_CHAPTER_VERSES[bookId]) console.error(`${bookId} is not a valid book id.`);
      const bookNumberAndId = path.parse(filename.replace('en_tn_', '')).name;
      const isNewTestament = BIBLE_LIST_NT.includes(bookNumberAndId);
      const originalLanguageId = isNewTestament ? NT_ORIG_LANG : OT_ORIG_LANG;
      const originalLanguageBibleId = isNewTestament ? NT_ORIG_LANG_BIBLE : OT_ORIG_LANG_BIBLE;
      const version = isNewTestament ? NT_ORIG_LANG_VERSION : OT_ORIG_LANG_VERSION;
      const originalBiblePath = path.join(
        ospath.home(),
        'translationCore',
        'resources',
        originalLanguageId,
        'bibles',
        originalLanguageBibleId,
        version
      );
      const filepath = path.join(sourcePath, filename);
      const groupData = await tsvToGroupData(filepath, 'translationNotes', {categorized: true}, originalBiblePath);

      formatAndSaveGroupData(groupData, outputPath, bookId);
    });

    await delay(200);

    // Generate groupsIndex using tN groupData & tA articles.
    const translationAcademyPath = path.join(
      ospath.home(),
      'translationCore',
      'resources',
      resource.languageId,
      'translationHelps',
      'translationAcademy'
    );

    const taCategoriesPath = resourcesHelpers.getLatestVersionInPath(translationAcademyPath);
    const categorizedGroupsIndex = generateGroupsIndex(outputPath, taCategoriesPath);

    saveGroupsIndex(categorizedGroupsIndex, outputPath);
  } catch (error) {
    throw Error(error);
  }
}

/**
 * Get missing original language resource
 * @param {String} resourcesPath - resources Path
 * @param {String} originalLanguageId - original language Id
 * @param {String} originalLanguageBibleId - original language bible Id
 * @param {String} version - version number
 * @return {Promise}
 */
function getMissingOriginalResource(resourcesPath, originalLanguageId, originalLanguageBibleId, version) {
  return new Promise(async (resolve, reject) => {
    try {
      const originalBiblePath = path.join(
        ospath.home(),
        'translationCore',
        'resources',
        originalLanguageId,
        'bibles',
        originalLanguageBibleId,
        version
      );

      const versionsSubdirectory = originalBiblePath.replace(version, '');
      const latestOriginalBiblePath = resourcesHelpers.getLatestVersionInPath(versionsSubdirectory);
      // if latest version is the version needed delete older versions
      if (latestOriginalBiblePath === originalBiblePath) {
        // Old versions of the orginal language resource bible will be deleted because the tn uses the latest version and not an older version
        resourcesHelpers.removeAllButLatestVersion(versionsSubdirectory);
      }
      console.log('originalBiblePath', originalBiblePath);
      console.log('originalBiblePath exists', fs.existsSync(originalBiblePath));
      // If version needed is not in the user resources download it.
      if (!fs.existsSync(originalBiblePath)) {
        // Download orig. lang. resource
        const downloadUrl = `https://cdn.door43.org/${originalLanguageId}/${originalLanguageBibleId}/${version}/${originalLanguageBibleId}.zip`;
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
        console.log('tn - resource', resource);
        // Delay to try to avoid Socket timeout
        await delay(1000);
        const result = await downloadAndProcessResource(resource, resourcesPath);
        resolve(result);
      } else {
        resolve();
      }
    } catch (error) {
      reject(error);
    }
  });
}
