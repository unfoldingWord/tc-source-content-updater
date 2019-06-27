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
import {delay, getQueryStringForBibleId, getQueryVariable} from '../utils';
// constants
import * as errors from '../../resources/errors';
import * as bibleUtils from '../../resources/bible';

/**
 * @description Processes the extracted files for translationNotes to separate the folder
 * structure and produce the index.js file for the language with the title of each article.
 * @param {Object} resource - Resource object
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * e.g. /Users/mannycolon/translationCore/resources/imports/en_tn_v16/en_tn
 * @param {String} outputPath - Path to place the processed resource files WITHOUT the version in the path
 */
export async function processTranslationNotes(resource, sourcePath, outputPath) {
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
  const OT_ORIG_LANG_QUERY = getQueryStringForBibleId(tsvRelations, bibleUtils.OT_ORIG_LANG);
  const NT_ORIG_LANG_QUERY = getQueryStringForBibleId(tsvRelations, bibleUtils.NT_ORIG_LANG);
  const OT_ORIG_LANG_VERSION = getQueryVariable(OT_ORIG_LANG_QUERY, 'v');
  const NT_ORIG_LANG_VERSION = getQueryVariable(NT_ORIG_LANG_QUERY, 'v');
  const tsvFiles = fs.readdirSync(sourcePath).filter((filename) => path.extname(filename) === '.tsv');

  tsvFiles.forEach(async(filename) => {
    const bookId = filename.split('-')[1].toLowerCase().replace('.tsv', '');
    if (!bibleUtils.BOOK_CHAPTER_VERSES[bookId]) console.error(`${bookId} is not a valid book id.`);
    const bookNumberAndId = path.parse(filename.replace('en_tn_', '')).name;
    const isNewTestament = bibleUtils.BIBLE_LIST_NT.includes(bookNumberAndId);
    const originalLanguageId = isNewTestament ? bibleUtils.NT_ORIG_LANG : bibleUtils.OT_ORIG_LANG;
    const originalLanguageBibleId = isNewTestament ? bibleUtils.NT_ORIG_LANG_BIBLE : bibleUtils.OT_ORIG_LANG_BIBLE;
    const version = 'v' + (isNewTestament ? NT_ORIG_LANG_VERSION : OT_ORIG_LANG_VERSION);
    const filepath = path.join(sourcePath, filename);
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
    if (!fs.existsSync(originalBiblePath)) {
      // download orig. lang. resource
    }
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
}
