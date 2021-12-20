//
// helpers
//

import fs from 'fs-extra';
import path from 'path-extra';
import os from 'os';
import rimraf from 'rimraf';
// import nock from 'nock';
import isEqual from 'deep-equal';
import _ from 'lodash';
import Updater from '../src';
import {getSubdirOfUnzippedResource, unzipResource} from '../src/helpers/resourcesHelpers';
import {download} from '../src/helpers/downloadHelpers';
import {NT_ORIG_LANG, NT_ORIG_LANG_BIBLE, OT_ORIG_LANG, OT_ORIG_LANG_BIBLE} from '../src/resources/bible';
import {compareVersions, getLatestVersion} from './_apiHelpers';


const HOME_DIR = os.homedir();
const USER_RESOURCES_PATH = path.join(HOME_DIR, 'translationCore/resources');
export const QUOTE_MARK = '\u2019';
export const DEFAULT_GATEWAY_LANGUAGE = 'en';
export const ORIGINAL_LANGUAGE = 'originalLanguage';
export const TARGET_LANGUAGE = 'targetLanguage';
export const TARGET_BIBLE = 'targetBible';
export const TRANSLATION_WORDS = 'translationWords';
export const TRANSLATION_NOTES = 'translationNotes';
export const TRANSLATION_ACADEMY = 'translationAcademy';
export const TRANSLATION_HELPS = 'translationHelps';
export const WORD_ALIGNMENT = 'wordAlignment';
const JSON_OPTS = {spaces: 2};

/**
 *
 * @param fullName
 * @param langId
 * @return {null|any|any}
 */
export function getResource(fullName, langId) {
  const outputFolder = './temp/tc_repos';
  const dataFolder = path.join(outputFolder, 'orgs');
  const repos = fs.readJsonSync(path.join(dataFolder, 'langRepos.json'));
  const langRepos = repos && repos[langId];
  if (langRepos) {
    for (const repo of langRepos) {
      if (repo.full_name === fullName) {
        return repo;
      }
    }
  }
  return null;
}

/**
 * download repo
 * @param {Object} resource
 * @param {string} resourcesPath
 * @return {Promise<String>}
 */
async function downloadRepo(resource, resourcesPath) {
  let zipFilePath;
  let importPath;
  let downloadComplete = false;
  const importsPath = path.join(resourcesPath, 'imports');
  let downloadUrl;

  try {
    const zipFileName = resource.name + '.zip';
    zipFilePath = path.join(importsPath, zipFileName);
    fs.ensureDirSync(importsPath);
    downloadUrl = resource.html_url + '/archive/master.zip';
    console.log('Downloading: ' + downloadUrl);
    const results = await download(downloadUrl, zipFilePath);
    if (results.status === 200) {
      downloadComplete = true;
    } else {
      const message = `Download ${resource.downloadUrl} error, status: ${results.status}`;
      console.log(message);
      throw message;
    }
  } catch (err) {
    throw Error(`UNABLE_TO_DOWNLOAD_RESOURCES for ${downloadUrl}: ${err.toString()}`);
  }
  try {
    console.log('Unzipping: ' + resource.downloadUrl);
    importPath = await unzipResource(resource, zipFilePath, resourcesPath);
  } catch (err) {
    throw Error(`UNABLE_TO_UNZIP_RESOURCES at ${zipFilePath}: ${err.toString()}`);
  }
  const importSubdirPath = getSubdirOfUnzippedResource(importPath);
  return importSubdirPath;
}

/**
 *
 * @param indexPath_
 * @return {*[]}
 */
export function getDirJson(indexPath_) {
  if (fs.existsSync(indexPath_)) {
    return fs.readdirSync(indexPath_).filter((item) => path.extname(item) === '.json');
  }
  return [];
}

/**
 *
 * @param projectPath
 * @param flag
 * @param chapter
 * @param verse
 * @return {*}
 */
function getAlignmentFlag(projectPath, flag, chapter, verse) {
  const flagged = fs.existsSync(path.join(projectPath, '.apps/translationCore/tools/wordAlignment/', flag, chapter, verse + '.json'));
  return flagged;
}

/**
 *
 * @param project
 * @param projectsPath
 * @return {{percentCompleted: number, completedVerses: number, totalVerses: number, unalignedTarget: number, langId: *, projectId: *, unalignedOrig: number, bookId: *}|null}
 */
export function verifyAlignments(project, projectsPath) {
  const projectPath = path.join(projectsPath, project);
  if (fs.lstatSync(projectPath).isDirectory()) {
    const [langId, projectId, bookId] = project.split('_');
    if (bookId) {
      // '/Users/blm/translationCore/projects/en_algn_tit_book/.apps/translationCore/alignmentData/tit'
      const alignmentSubPath = `.apps/translationCore/alignmentData/${bookId}`;
      const indexPath_ = path.join(projectPath, alignmentSubPath);
      let totalVerses = 0;
      let completedVerses = 0;
      let unalignedOrig = 0;
      let unalignedTarget = 0;
      const files = getDirJson(indexPath_);
      // console.log(files);
      let percentCompleted;

      for (const file of files) {
        const chapter = path.base(file);
        const chapterData = fs.readJsonSync(path.join(indexPath_, file));
        const verses = Object.keys(chapterData);
        for (const verse of verses) {
          totalVerses++;
          const verseData = chapterData[verse];
          let originalUnAlignedCount = 0;
          const wordBankCount = verseData.wordBank && verseData.wordBank.length || 0;
          for (const alignment of verseData.alignments || []) {
            if (alignment.bottomWords.length === 0) {
              originalUnAlignedCount += alignment.topWords.length;
            }
          }
          let incomplete = (wordBankCount > 0) && (originalUnAlignedCount > 0);
          if (incomplete) {
            const completed = getAlignmentFlag(projectPath, 'completed', chapter, verse);
            if (completed) {
              incomplete = false;
            }
          }
          if (!incomplete) {
            const invalid = getAlignmentFlag(projectPath, 'invalid', chapter, verse);
            if (invalid) {
              incomplete = true;
            }
          }
          completedVerses += (!incomplete) ? 1 : 0;
          unalignedOrig += originalUnAlignedCount;
          unalignedTarget += wordBankCount;
        }
      }
      if (totalVerses === 0) {
        percentCompleted = 0;
      } else {
        percentCompleted = completedVerses / totalVerses;
        if (percentCompleted < 1 && percentCompleted > 0.99) {
          percentCompleted = 0.99;
        }
      }
      console.log(`${project}: ${totalVerses} totalVerses, ${completedVerses} completedVerses, ${Math.round(100 * percentCompleted)}% completed`);
      return {
        langId,
        projectId,
        bookId,
        percentCompleted,
        completedVerses,
        totalVerses,
        unalignedOrig,
        unalignedTarget,
      };
    }
  }
  return null;
}

/**
 *
 * @param projectsPath
 * @param project
 * @param checkMigration
 * @return {Promise<null>}
 */
export async function verifyChecks(projectsPath, project, checkMigration) {
  const projectPath = path.join(projectsPath, project);
  const [langId, projectId, bookId] = project.split('_');
  const results = {langId, projectId, bookId};
  let origLangResourcePath;
  let tnResourceGl;
  const toolsData = {};
  if (fs.lstatSync(projectPath).isDirectory() && fs.existsSync(path.join(projectPath, 'manifest.json'))) {
    const projectManifest = getProjectManifest(projectPath);
    if (checkMigration) {
      if (fs.existsSync(USER_RESOURCES_PATH)) {
        origLangResourcePath = await loadOlderOriginalLanguageResource(projectPath, bookId, TRANSLATION_NOTES);
        if (!origLangResourcePath) {
          console.error('error downloading original language');
          checkMigration = false;
        } else {
          const {toolsSelectedGLs} = projectManifest;
          tnResourceGl = toolsSelectedGLs && toolsSelectedGLs.translationNotes;
        }
      } else {
        console.log(`resource folder not found: ${USER_RESOURCES_PATH}`);
      }
    }

    results.time_created = projectManifest.time_created;
    results.tc_edit_version = projectManifest.tc_edit_version;
    results.tc_version = projectManifest.tc_version;
    const tools = [WORD_ALIGNMENT, TRANSLATION_NOTES, TRANSLATION_WORDS];
    for (const tool of tools) {
      const toolData = {};
      toolsData[tool] = toolData;
      toolData.SelectedGL = projectManifest.toolsSelectedGLs && projectManifest.toolsSelectedGLs[tool];
      toolData.orig_lang_check_version = projectManifest[`tc_orig_lang_check_version_${tool}`];
      if (tool === TRANSLATION_NOTES) {
        toolData.gl_check_version = projectManifest[`tc_${toolData.SelectedGL}_check_version_translationNotes`];
      }
    }

    if (bookId) {
      const projectPath = path.join(projectsPath, project);
      const tools = [TRANSLATION_NOTES, TRANSLATION_WORDS];
      for (const tool of tools) {
        const indexSubPath = '.apps/translationCore/index/' + tool + '/' + bookId;
        const indexPath_ = path.join(projectPath, indexSubPath);
        let totalChecks = 0;
        let completedChecks = 0;
        const files = getDirJson(indexPath_);
        // console.log(files);
        let percentCompleted;

        for (const file of files) {
          const checks = fs.readJsonSync(path.join(indexPath_, file));
          for (const check of checks) {
            totalChecks++;
            completedChecks += (check.selections || check.nothingToSelect) ? 1 : 0;
          }
        }
        if (totalChecks === 0) {
          percentCompleted = 0;
        } else {
          percentCompleted = completedChecks / totalChecks;
          if (percentCompleted < 1 && percentCompleted > 0.99) {
            percentCompleted = 0.99;
          }
        }
        results[tool] = {
          percentCompleted,
          completedChecks,
          totalChecks,
        };
        console.log(project + '-' + tool + ': ' + totalChecks + ' totalChecks, ' + completedChecks + ' completedChecks, ' + Math.round(100 * percentCompleted) + '% completed');
        let haveResources = origLangResourcePath;
        if (tool === TRANSLATION_NOTES && !tnResourceGl) {
          haveResources = false;
        }
        if (haveResources) {
          const stats = getUniqueChecks(projectsPath, project, tool, origLangResourcePath, tnResourceGl, checkMigration);
          if (stats) {
            results[tool] = {
              toolData: toolsData[tool],
              ...results[tool],
              stats,
            };
          }
        } else {
          console.log(`missing resources for ${tool}`);
        }
      }
    }
  }
  const tool = WORD_ALIGNMENT;
  results[tool] = {
    toolData: toolsData[tool],
  };
  return results;
}

/**
 *
 * @param resource
 * @param resourcesPath
 * @param fullName
 * @param checkMigration
 * @return {Promise<{checks: null, checkMigration, fullName, wA: ({percentCompleted: number, completedVerses: number, totalVerses: number, unalignedTarget: number, langId: *, projectId: *, unalignedOrig: number, bookId: *}|null)}|{checkMigration, fullName, ERROR: string}>}
 */
export async function downloadAndVerifyProject(resource, resourcesPath, fullName, checkMigration) {
  const project = resource.name;
  let results;
  fs.ensureDirSync(resourcesPath);
  const importFolder = path.join(resourcesPath, 'imports');
  if (fs.existsSync(importFolder)) {
    rimraf.sync(importFolder, fs);
  }
  try {
    const filePath = await downloadRepo(resource, resourcesPath);
    console.log(filePath);
    const projectsPath = path.join(importFolder, project);
    const wA = verifyAlignments(project, projectsPath);
    const checks = await verifyChecks(projectsPath, project, checkMigration);
    results = {
      fullName,
      wA,
      checks,
      checkMigration,
    };
  } catch (e) {
    const errStr = e.toString();
    let message = `Could not download ${resource.full_name}: ${errStr}`;
    if (errStr.indexOf('code 404') > 0) {
      message = `Empty Repo: ${resource.full_name}: ${errStr}`;
    } else {
      console.log('other');
    }
    console.log(message, e);
    results = {
      fullName,
      ERROR: message,
      checkMigration,
    };
  }
  return results;
}

/**
 * array of checks for groupId
 * @param {Array} resourceData
 * @param {object} matchRef
 * @return {number}
 */
function getReferenceCount(resourceData, matchRef) {
  let count = 0;

  for (const resource of resourceData) {
    if (isEqual(resource.contextId.reference, matchRef)) {
      count++;
    }
  }
  return count;
}

/**
 * compares quotes, with fallback to old handling of quote marks
 * @param projectCheckQuote
 * @param resourceQuote
 * @return {*|boolean}
 */
export function areQuotesEqual(projectCheckQuote, resourceQuote) {
  let same = isEqual(projectCheckQuote, resourceQuote);

  if (!same) { // if not exactly the same, check for old quote handling in project quote
    // a quick sanity check, the old quote would be longer if the quote mark is split out
    if (Array.isArray(projectCheckQuote) && Array.isArray(resourceQuote) && projectCheckQuote.length > resourceQuote.length) {
      let index = projectCheckQuote.findIndex(item => (item.word === QUOTE_MARK)); // look for quote mark
      const quoteMarkFound = index > 1;

      if (quoteMarkFound) { // if quote mark split out, migrate to new format
        const newQuote = _.cloneDeep(projectCheckQuote);
        let done = false;

        while (!done) {
          if (index > 1) {
            // move quote mark to previous word
            const previousItem = newQuote[index - 1];
            previousItem.word += QUOTE_MARK;
            newQuote.splice(index, 1);
            index = newQuote.findIndex(item => (item.word === QUOTE_MARK));
          } else {
            done = true;
          }
        }

        same = isEqual(newQuote, resourceQuote);
      }
    }
  }
  return same;
}

/**
 * update old resource data
 * @param {array} resourceData
 * @param {String} bookId
 * @param {Object} data - resource data to update
 * @return {Object}
 */
export function updateCheckingResourceData(resourceData, bookId, data) {
  let dataModified = false;
  let updatedCheckId = false;
  let updatedQuote = false;
  let matchFound = false;
  let quotesMatch = false;
  let resourcePartialMatches = 0;
  let matchedResource = null;
  let duplicateMigration = false;

  if (resourceData) {
    for (const resource of resourceData) {
      if (data.contextId.groupId === resource.contextId.groupId &&
        isEqual(data.contextId.reference, resource.contextId.reference) &&
        data.contextId.occurrence === resource.contextId.occurrence) {
        if (!areQuotesEqual(data.contextId.quote, resource.contextId.quote)) { // quotes are  not the same
          if (data.contextId.checkId) {
            if (data.contextId.checkId === resource.contextId.checkId) {
              matchFound = true; // found match
            }
          } else { // there is not a check ID in this check, so we try empirical methods
            // if only one check for this verse, then we update presuming that this is just an original language change.
            // If more than one check in this groupID for this verse, we skip since it would be too easy to change the quote in the wrong check
            const count = getReferenceCount(resourceData, resource.contextId.reference);
            matchFound = (count === 1);
            resourcePartialMatches = count;
          }

          if (matchFound) {
            matchedResource = resource;
            updatedQuote = !isEqual(data.contextId.quote, resource.contextId.quote);
            // data.contextId.quote = resource.contextId.quote; // update quote
            // data.contextId.quoteString = resource.contextId.quoteString; // update quoteString

            if (!data.contextId.checkId && resource.contextId.checkId) {
              // data.contextId.checkId = resource.contextId.checkId; // add check ID
              updatedCheckId = true;
            }
            dataModified = true;
          }
        } else { // quotes match
          quotesMatch = true;
          if (data.contextId.checkId) {
            if (data.contextId.checkId === resource.contextId.checkId) {
              matchFound = true;
            }
          } else { // no check id in current check, and quotes are similar
            matchFound = true;

            // see if there is a checkId to be added
            if (resource.contextId.checkId) {
              // data.contextId.checkId = resource.contextId.checkId; // save checkId
              updatedCheckId = true;
              dataModified = true;
            }
          }

          if (matchFound && !isEqual(data.contextId.quote, resource.contextId.quote)) {
            // if quotes not exactly the same, update
            // data.contextId.quote = resource.contextId.quote;
            // data.contextId.quoteString = resource.contextId.quoteString;
            dataModified = true;
            updatedQuote = true;
          }
        }

        if (matchFound) {
          matchedResource = resource;
          if (resource.matches) {
            resource.matches++;
            duplicateMigration = resource.matches;
            console.log(`duplicate resource found ${JSON.stringify(resource)}: count= ${resource.matches}`);
          } else {
            resource.matches = 1;
          }
          break;
        }
      }
    }

    if (!matchFound) {
      console.warn('updateCheckingResourceData() - resource not found for migration: ' + JSON.stringify(data));
    }
  }
  return {
    dataModified,
    updatedCheckId,
    updatedQuote,
    matchFound,
    resourcePartialMatches,
    matchedResource,
    duplicateMigration,
    quotesMatch
  };
}

/**
 * get list of folders in resource path
 * @param {String} resourcePath - path
 * @return {Array} - list of folders
 */
export function getFoldersInResourceFolder(resourcePath) {
  try {
    const folders = fs.readdirSync(resourcePath).filter(folder =>
      fs.lstatSync(path.join(resourcePath, folder)).isDirectory()); // filter out anything not a folder
    return folders;
  } catch (error) {
    console.error(error);
  }
}

/**
 * get list of files in resource path
 * @param {String} resourcePath - path
 * @param {String|null} [ext=null] - optional extension to match
 * @return {Array}
 */
export function getFilesInResourcePath(resourcePath, ext=null) {
  if (fs.lstatSync(resourcePath).isDirectory()) {
    let files = fs.readdirSync(resourcePath).filter(file => {
      if (ext) {
        return path.extname(file) === ext;
      }
      return file !== '.DS_Store';
    }); // filter out .DS_Store
    return files;
  }
  return [];
}

/**
 *
 * @param item
 * @return {string}
 * @private
 */
function getKey_(item) {
  const key = getKey(
    item.contextId.reference.checkId,
    item.contextId.reference.chapter,
    item.contextId.reference.verse,
    item.contextId.groupId,
    item.contextId.occurrence
  );
  return key;
}

/**
 * update the resources for this file
 * @param newResourceChecks
 * @param existingSelections
 * @param {String} bookId
 * @param {Boolean} isContext - if true, then data is expected to be a contextId, otherwise it contains a contextId
 */
function validateCheckMigrations(existingSelections, newResourceChecks, bookId) {
  let migrations = {};
  let unmatched = [];
  let duplicateMigrations = [];
  try {
    const keys = Object.keys(existingSelections);
    for (const key of keys) {
      const list = existingSelections[key];
      for (const item of list) {
        const groupId = item.contextId && item.contextId.groupId;
        if (groupId) {
          const {
            dataModified,
            updatedCheckId,
            updatedQuote,
            matchFound,
            resourcePartialMatches,
            matchedResource,
            duplicateMigration,
            quotesMatch
          } = updateCheckingResourceData(newResourceChecks[groupId], bookId, item);
          if (item.selections) {
            const checkKey = getKey_(item);
            const resourceKey = matchedResource ? getKey_(matchedResource) : '';
            const selections = item.selections.map((item) => (`${item.text}-${item.occurrence}`)).join(' ');
            if (!matchFound) {
              unmatched.push({
                key: checkKey,
                selections,
                resourcePartialMatches,
              });
            }
            if (duplicateMigration) {
              duplicateMigrations.push({
                resourceKey,
                duplicateMigration
              })
            }
            console.log(key);
            // TODO add warnings to migrations
            // item.migrationChecks = results;
          }
        }
      }
    }
  } catch (e) {
    console.error('updateResourcesForFile() - migration error for: ' + bookId, e);
  }
  return {
    migrations,
    duplicateMigrations,
    unmatched,
  };
}

/**
 * iterate through checking data to make sure it is up to date
 * @param {String} projectsDir - path to project
 * @param bookId
 * @param {String} toolName
 * @param uniqueChecks
 * @param helpsPath
 */
export function validateMigrations(projectsDir, bookId, toolName, uniqueChecks, helpsPath) {
  let migrations = {};
  if (fs.existsSync(helpsPath)) {
    const groups = getFoldersInResourceFolder(helpsPath);
    const groupChecks = {};

    for (const group of groups) {
      // console.log(`validateMigrations() - migrating ${group} to new format`);
      const bookPath = path.join(helpsPath, group, 'groups', bookId);

      if (fs.existsSync(bookPath)) {
        const checkFiles = getFilesInResourcePath(bookPath, '.json');
        for (const checkFile of checkFiles) {
          const checkPath = path.join(bookPath, checkFile);
          const checks = fs.readJsonSync(checkPath);
          const groupId = path.base(checkFile);
          if (!groupChecks[groupId]) {
            groupChecks[groupId] = [];
          }
          groupChecks[groupId] = groupChecks[groupId].concat(checks);
        }
      }
    }
    migrations = validateCheckMigrations(uniqueChecks, groupChecks, bookId);
    console.log('migrateOldCheckingResourceData() - migration done');
  }
  return migrations;
}

/**
 *
 * @param checkId
 * @param chapter
 * @param verse
 * @param groupId
 * @param occurrence
 * @return {string}
 */
function getKey(checkId, chapter, verse, groupId, occurrence) {
  const key = `${groupId}_${chapter}_${verse}_${checkId || ''}_${occurrence}`;
  return key;
}

/**
 *
 * @param projectsPath
 * @param project
 * @param toolName
 * @param origLangResourcePath
 * @param tnResourceGl
 * @param checkMigration
 * @return {{dupes: {}, toolWarnings: string}}
 */
function getUniqueChecks(projectsPath, project, toolName, origLangResourcePath, tnResourceGl, checkMigration) {
  const uniqueChecks = {};
  const dupes = {};
  let migrations = {};
  const migrationData = {};
  let toolWarnings = '';
  const version = path.base(origLangResourcePath);
  let helpsPath;
  if (toolName === TRANSLATION_NOTES) {
    helpsPath = path.join(origLangResourcePath, '../../../..', tnResourceGl, 'translationHelps', TRANSLATION_NOTES);
    helpsPath = getLatestVersion(helpsPath);
    migrationData.glVersion = path.base(helpsPath);
  } else {
    helpsPath = path.join(origLangResourcePath, '../../../translationHelps', toolName, version);
    migrationData.glVersion = version;
  }

  const [langId, projectId, bookId] = project.split('_');
  try {
    const groupDataPath = path.join(projectsPath, project, '.apps/translationCore/index', toolName, bookId);
    const indexFiles = getDirJson(groupDataPath);
    for (const indexFile of indexFiles) {
      const groupData = fs.readJsonSync(path.join(groupDataPath, indexFile));
      for (const groupItem of groupData) {
        if (groupItem.contextId) {
          const {chapter, verse} = groupItem.contextId.reference;
          const {checkId, groupId, occurrence} = groupItem.contextId;
          const key = getKey(checkId, chapter, verse, groupId, occurrence);
          if (!uniqueChecks[key]) {
            uniqueChecks[key] = [];
          }
          uniqueChecks[key].push(groupItem);
        }
      }
    }
    const keys = Object.keys(uniqueChecks);
    for (const key_ of keys) {
      let dupeSelections = 0;
      const uniqueCheck = uniqueChecks[key_];
      if (uniqueCheck.length > 1) {
        let warnings = '';
        const selections = uniqueCheck.filter((check) => check.selections);
        if (selections.length) {
          if (selections.length < uniqueCheck.length) {
            const missingSelections = uniqueCheck.length - selections.length;
            warnings += `Missing ${missingSelections} selections\t`;
          }
          if (selections.length > 1) {
            for (let i = 0; i < selections.length - 1; i++) {
              for (let j = i + 1; j < selections.length; j++) {
                if (isEqual(selections[i], selections[j])) {
                  dupeSelections++;
                }
              }
            }
            if (dupeSelections) {
              warnings += `${dupeSelections+1} selections duplicated\t`;
            }
          }
        }
        if (warnings) {
          toolWarnings += `${key_} - ${warnings}\n`;
        }
        if (dupeSelections) {
          const dupesList = uniqueCheck.map((item) => (Array.isArray(item.selections) ? item.selections.map((item) => (`${item.text}-${item.occurrence}`)).join(' ') : (item.selections || '').toString()));
          dupes[key_] = {
            dupesList,
            warnings,
          };
        }
      }
    }
    if (checkMigration) {
      migrations = validateMigrations(projectsPath, bookId, toolName, uniqueChecks, helpsPath);
      migrations.data = migrationData;
    }
  } catch (e) {
    const message = `error processing ${project}: ${e.toString()}\n`;
    console.log(message);
    toolWarnings += message;
  }
  console.log(`checks processed: ${project}`);
  return {
    dupes,
    migrations,
    toolWarnings,
  };
}

/**
 *
 * @param reposFormat
 * @param reposLines
 * @param outputFolder
 * @param outputFile
 */
export function writeToTsv(reposFormat, reposLines, outputFolder, outputFile) {
  const lines = [];
  let line = '';
  // write header
  for (const field of reposFormat) {
    const fieldKey = field.key;
    const fieldText = field.text;
    let value = fieldText || fieldKey;
    line += value + '\t';
  }
  lines.push(line);
  for (const repoline of reposLines) {
    let line = '';
    for (const field of reposFormat) {
      const fieldKey = field.key;
      let value = repoline[fieldKey];
      if (typeof(value) === 'object') {
        value = JSON.stringify(value);
      } else if ((value !== 0) && !value) {
        value = '';
      }
      line += value + '\t';
    }
    lines.push(line);
  }
  fs.ensureDirSync(outputFolder);
  const data = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(outputFolder, outputFile), data, 'utf8');
  return data;
}

/**
 *
 * @param reposLines
 * @param sortKey
 * @return {*}
 */
export function sortStringObjects(reposLines, sortKey) {
  const keySort = (a, b) => {
    const x = a[sortKey].toLowerCase();
    const y = b[sortKey].toLowerCase();
    if (x < y) {
      return -1;
    }
    if (x > y) {
      return 1;
    }
    return 0;
  };
  const sorted = reposLines.sort(keySort);
  return sorted;
}

/**
 *
 * @param reposLines
 * @param sortKey
 * @param reverse
 * @return {*}
 */
export function sortObjects(reposLines, sortKey, reverse) {
  const keySort = (a, b) => {
    const x = a[sortKey];
    const y = b[sortKey];
    let result = 0;
    if (x < y) {
      result = -1;
    } else if (x > y) {
      result = 1;
    }
    if (reverse) {
      result = -result;
    }
    return result;
  };
  const sorted = reposLines.sort(keySort);
  return sorted;
}

function getLocalizedGroupId(dupeId, tool, selectedGL) {
  const groupId = dupeId.split('_')[0];
  const article = loadArticleData(tool, groupId, selectedGL);
  let localizedGroupId = groupId;
  if (article && (article.indexOf('Article Not Found:') <= 0)) {
    const parts = article.split('#');
    if ((parts.length > 1) && parts[1]) {
      localizedGroupId = parts[1].trim();
    } else {
      console.log(article);
    }
  }
  return localizedGroupId;
}

/**
 *
 * @param outputFolder
 * @param langId
 * @param org
 */
export function summarizeProjects(outputFolder, langId, org) {
  const summaryFile = path.join(outputFolder, 'orgs', `${langId}-${org}-repos.json`);
  if (fs.existsSync(summaryFile)) {
    const summary = fs.readJsonSync(summaryFile);
    const {
      projectSummaries: projectResults,
      goodProjects: {
        waFinished,
        waNearlyFinished,
        allFinished,
        allNearlyFinished,
      },
    } = summary;

    const reposLines = [];

    const projectNames = Object.keys(projectResults);
    for (const projectName of projectNames) {
      let projectWarning = '';
      const repoLine = {};
      const project = projectResults[projectName];
      repoLine.fullName = project.fullName;
      repoLine.modified = project.updated_at;
      if (project.ERROR) {
        repoLine.projectError = project.ERROR;
      } else {
        repoLine.waPercentComplete = 0;
        repoLine.twPercentComplete = 0;
        repoLine.tnPercentComplete = 0;
        if (project.wA) {
          repoLine.waPercentComplete = project.wA.percentCompleted || 0;
          repoLine.twPercentComplete = 0;
          repoLine.tnPercentComplete = 0;
          if (project.checks) {
            const checks = project.checks;
            repoLine.time_created = checks.time_created;
            repoLine.tc_edit_version = checks.tc_edit_version;
            repoLine.tc_version = checks.tc_version;
            // repoLine.timeCreated = checks.time_created;
            const tools = {[WORD_ALIGNMENT]: 'wa', [TRANSLATION_WORDS]: 'tw', [TRANSLATION_NOTES]: 'tn'};
            for (const tool of Object.keys(tools)) {
              const projectLines = [];
              let selectedGL = null;
              const toolShort = tools[tool];
              const toolData = checks[tool] && checks[tool].toolData;
              if (toolData) {
                selectedGL = toolData.SelectedGL;
                repoLine[`${toolShort}_gl`] = selectedGL;
                const olVersion = toolData.orig_lang_check_version;
                repoLine[`${toolShort}_orig_lang_check_version`] = olVersion ? 'v' + olVersion : '';
                repoLine[`${toolShort}_gl_check_version`] = toolData.gl_check_version;
              }

              if ([TRANSLATION_WORDS, TRANSLATION_NOTES].includes(tool)) {
                const toolData = checks[tool] && checks[tool].stats;
                if (toolData) {
                  let dupesFound = false;
                  const dupeIds = toolData.dupes ? Object.keys(toolData.dupes) : [];
                  if (dupeIds.length) {
                    dupesFound = true;
                    for (const dupeId of dupeIds) {
                      const dupe = toolData.dupes[dupeId];
                      const localizedGroupId = getLocalizedGroupId(dupeId, tool, selectedGL);
                      const dupeLine = {
                        reference: dupeId,
                        localizedGroupId,
                        message: dupe.warnings && dupe.warnings.replace('\t', ' ') || '',
                        selections: JSON.stringify(dupe.dupesList),
                      };
                      projectLines.push(dupeLine);
                    }
                  }
                  if (dupesFound) {
                    projectWarning += `duplicate ${toolShort} selections found, `;
                  }
                  dupesFound = false;
                  const migrationData = toolData.migrations;
                  const duplicateMigrations = migrationData && migrationData.duplicateMigrations || [];
                  if (duplicateMigrations && duplicateMigrations.length) {
                    dupesFound = true;
                    for (const dupe of duplicateMigrations) {
                      const localizedGroupId = getLocalizedGroupId(dupe.resourceKey, tool, selectedGL);
                      const dupeLine = {
                        reference: dupe.resourceKey,
                        localizedGroupId,
                        message: `${dupe.duplicateMigration} duplicate migrations`,
                      };
                      projectLines.push(dupeLine);
                    }
                  }
                  if (dupesFound) {
                    projectWarning += `duplicate ${toolShort} migrations found, `;
                  }
                  let unmatchedFound = false;
                  const unmatchedChecks = migrationData && migrationData.unmatched || [];
                  if (unmatchedChecks && unmatchedChecks.length) {
                    unmatchedFound = true;
                    for (const unmatched of unmatchedChecks) {
                      let message = `unable to migrate selection, no match found for check in new resources`;
                      if (unmatched.resourcePartialMatches) {
                        message = `unable to migrate selection, there are ${unmatched.resourcePartialMatches} similar checks`;
                      }
                      const localizedGroupId = getLocalizedGroupId(unmatched.key, tool, selectedGL);
                      const line = {
                        reference: unmatched.key,
                        message,
                        localizedGroupId,
                        selections: unmatched.selections,
                      };
                      projectLines.push(line);
                    }
                  }
                  if (unmatchedFound) {
                    projectWarning += `unmatched ${toolShort} checks found, `;
                  }
                }
              }
              const projectSummaryFolder = path.join(outputFolder, 'summary', langId);
              const projectSummaryFileName = `${repoLine.fullName.replace('/', '-')}-${toolShort}-summary.tsv`;
              const projectsFormat = [
                {
                  key: 'reference',
                  text: 'Reference',
                },
                {
                  key: 'localizedGroupId',
                  text: 'Localized Group',
                },
                {
                  key: `message`,
                  text: 'Message',
                },
                {
                  key: `selections`,
                  text: 'Selections',
                },
              ];
              if (projectLines.length) {
                writeToTsv(projectsFormat, sortStringObjects(projectLines, 'reference'), projectSummaryFolder, projectSummaryFileName);
              }
            }
            repoLine.twPercentComplete = project.checks.translationWords && project.checks.translationWords.percentCompleted || 0;
            repoLine.tnPercentComplete = project.checks.translationNotes && project.checks.translationNotes.percentCompleted || 0;
          }
          repoLine.waPercentComplete = Math.round(repoLine.waPercentComplete * 100);
          repoLine.twPercentComplete = Math.round(repoLine.twPercentComplete * 100);
          repoLine.tnPercentComplete = Math.round(repoLine.tnPercentComplete * 100);
          if (projectWarning) {
            repoLine.warnings = projectWarning;
          }
        }
      }
      reposLines.push(repoLine);
    }
    const reposFormat = [
      {
        key: 'fullName',
        text: 'Project',
      },
      {
        key: 'modified',
        text: 'Modified',
      },
      {
        key: `waPercentComplete`,
        text: 'wA % Done',
      },
      {
        key: `wa_gl`,
        text: 'wA GL',
      },
      {
        key: `wa_orig_lang_check_version`,
        text: 'wA Orig Lang Check Version',
      },
      {
        key: `twPercentComplete`,
        text: 'tW % Done',
      },
      {
        key: `tw_gl`,
        text: 'tW GL',
      },
      {
        key: `tw_orig_lang_check_version`,
        text: 'tW Orig Lang Check Version',
      },
      {
        key: `tnPercentComplete`,
        text: 'tN % Done',
      },
      {
        key: `tn_gl`,
        text: 'tN GL',
      },
      {
        key: `tn_gl_check_version`,
        text: 'tN GL Check Version',
      },
      {
        key: `tn_orig_lang_check_version`,
        text: 'tN Orig Lang Check Version',
      },
      {
        key: `time_created`,
        text: 'Time Created',
      },
      {
        key: `tc_edit_version`,
        text: 'tC Edit Version',
      },
      {
        key: `tc_version`,
        text: 'tC Format Version',
      },
      {
        key: `warnings`,
        text: 'Project warnings',
      },
      {
        key: `projectError`,
        text: 'Project Error',
      },
    ];
    const summaryFolder = path.join(outputFolder, 'summary');
    writeToTsv(reposFormat, sortStringObjects(reposLines, 'fullName'), summaryFolder, `${langId}-${org}-summary.tsv`);
  }
}

/**
 *
 * @param repos
 * @param resourcesPath
 * @param outputFolder
 * @param langId
 * @param org
 * @param checkMigration
 * @return {Promise<void>}
 */
export async function validateProjects(repos, resourcesPath, outputFolder, langId, org, checkMigration, retryFailedDownloads, defaultDate=null) {
  let projectsResults = {};
  defaultDate = defaultDate || (new Date()).toJSON();
  const summaryFile = path.join(outputFolder, 'orgs-pre', `${langId}-${org}-repos.json`);
  if (fs.existsSync(summaryFile)) {
    const summary = fs.readJsonSync(summaryFile);
    if (summary && summary.projects) {
      projectsResults = summary.projects;
    }
  }
  for (let i = repos.length - 1; i > 0; i--) {
    const project = repos[i];
    const projectResults = projectsResults[project.full_name];
    if (projectResults) {
      if (retryFailedDownloads && projectResults.ERROR) {
        delete projectResults.ERROR;
        delete projectResults.checkMigration;
      } else {
        let modified = projectResults.modified;
        if (!modified) {
          modified = defaultDate;
          projectResults.updated_at = modified;
        }
        if (project.updated_at > modified) {
          // process updated repo
          console.log(`repo updated ${project.full_name}`);
        } else if (checkMigration) {
          if (projectResults.checkMigration) {
            console.log(`skipping over ${project} already migration checked`);
            continue; // skip over if repo already checked migration
          }
        } else {
          console.log(`skipping over ${project} since we are not doing migration checking`);
          continue; // skip over if repo already processed
        }
      }
    }
    console.log(`${i+1} - Loading ${project.full_name}`);
    const results = await downloadAndVerifyProject(project, resourcesPath, project.full_name, checkMigration);
    const waWarnings = results && results.wA && results.wA.warnings || '';
    const tnWarnings = results && results.checks && results.checks.translationNotes && results.checks.translationNotes.stats && results.checks.translationNotes.stats.toolWarnings || '';
    const twWarnings = results && results.checks && results.checks.translationWords && results.checks.translationWords.stats && results.checks.translationWords.stats.toolWarnings || '';
    if (waWarnings || tnWarnings || twWarnings) {
      const projectWarnings = `warnings: WA: ${waWarnings}, TN: ${tnWarnings}, TW: ${twWarnings}`;
      console.log(projectWarnings);
      results.projectWarnings = projectWarnings;
    }
    // console.log(JSON.stringify(results));
    results.modified = project.updated_at;
    projectsResults[project.full_name] = results;
    const totalProjects = repos.length;
    const processedProjects = repos.length - i + 1;

    const summary = {
      processedProjects,
      totalProjects,
      projects: projectsResults,
    };
    fs.outputJsonSync(summaryFile, summary, JSON_OPTS);
  }

  const projectNames = Object.keys(projectsResults);
  const waFinished = {};
  const waNearlyFinished = {};
  const allFinished = {};
  const allNearlyFinished = {};
  for (const projectName of projectNames) {
    try {
      const project = projectsResults[projectName];
      const fullName = project.fullName;
      let waPercentComplete = 0;
      let twPercentComplete = 0;
      let tnPercentComplete = 0;
      if (project.wA) {
        waPercentComplete = project.wA.percentCompleted || 0;
        if (waPercentComplete >= 0.9) {
          if (waPercentComplete === 1) {
            waFinished[fullName] = project;
          } else {
            waNearlyFinished[fullName] = project;
          }
          if (project.checks) {
            twPercentComplete = project.checks.translationWords && project.checks.translationWords.percentCompleted || 0;
            tnPercentComplete = project.checks.translationNotes && project.checks.translationNotes.percentCompleted || 0;
            if (twPercentComplete >= 0.9 && tnPercentComplete >= 0.9) {
              if (twPercentComplete === 1 && tnPercentComplete === 1) {
                allFinished[fullName] = project;
              } else {
                allNearlyFinished[fullName] = project;
              }
            }
          }
        }
      }
    } catch (e) {
      const projectWarnings = `project failed: ${e.toString()}`;
      console.log(`${projectName} - ${projectWarnings}`);
      results.projectWarnings = projectWarnings;
      // console.log(JSON.stringify(results));
      if (!projectsResults[projectName]) {
        projectsResults[projectName] = {};
      }
      projectsResults[projectName].projectWarnings = projectWarnings;
    }
  }
  const results = {
    projectSummaries: projectsResults,
    goodProjects: {
      waFinished,
      waNearlyFinished,
      allFinished,
      allNearlyFinished,
    },
  };

  const outputFile = path.join(outputFolder, 'orgs', `${langId}-${org}-repos.json`);
  fs.outputJsonSync(outputFile, results, JSON_OPTS);
  console.log(`saved results into ${outputFile}`);
}

/**
 * Returns the versioned folder within the directory with the highest value.
 * e.g. `v10` is greater than `v9`
 * @param {Array} versions - list of versions found
 * @returns {string|null} the latest version found
 */
export const getLatestVersion_ = (versions) => {
  if (versions && (versions.length > 0)) {
    const sortedVersions = versions.sort((a, b) =>
      -compareVersions(a, b), // do inverted sort
    );
    return sortedVersions[0]; // most recent version will be first
  } else {
    return null;
  }
};

/**
 * Search folder for most recent version
 * @param {string} bibleFolderPath
 * @return {string} latest version found
 */
function getMostRecentVersionInFolder(bibleFolderPath) {
  const versionNumbers = fs.readdirSync(bibleFolderPath).filter((folder) => folder !== '.DS_Store'); // ex. v9
  const latestVersion = getLatestVersion_(versionNumbers);
  return latestVersion;
}

/**
 *
 * @param projectPath
 * @return {{}|*}
 */
export function getProjectManifest(projectPath) {
  if (fs.existsSync(projectPath)) {
    return fs.readJsonSync(path.join(projectPath, 'manifest.json'));
  }
  return {};
}

/**
 * Returns the original language version number needed for tn's group data files.
 * @param {array} tsvRelations
 * @param {string} resourceId
 */
export function getTsvOLVersion(tsvRelations, resourceId) {
  try {
    let tsvOLVersion = null;

    if (tsvRelations) {
      // Get the query string from the tsv_relation array for given resourceId
      const query = tsvRelations.find((query) => query.includes(resourceId));

      if (query) {
        // Get version number from query
        tsvOLVersion = query.split('?v=')[1];
      }
    }
    return tsvOLVersion;
  } catch (error) {
    console.error(error);
  }
}

/**
 * get current Original language resources by tN
 * @return {null|string}
 * @param projectPath
 * @param bookId
 */
export function getCurrentOrigLangVersionForTn(projectPath, bookId) {
  const {bibleId: origLangBibleId} = getOrigLangforBook(bookId);
  // tn files are generated from a specific version number of the original language resources which are reference as relation
  const {tsv_relation} = getProjectManifest(projectPath);
  // Get version number needed by tn's tsv
  const tsvOLVersion = getTsvOLVersion(tsv_relation, origLangBibleId);
  return tsvOLVersion;
}

/**
 * Loads a bible book resource.
 * @param bibleId
 * @param bookId
 * @param languageId
 * @param version
 * @return {object}
 */
export const loadBookResource = (bibleId, bookId, languageId, version = null) => {
  try {
    const bibleFolderPath = path.join(USER_RESOURCES_PATH, languageId, 'bibles', bibleId); // ex. user/NAME/translationCore/resources/en/bibles/ult

    if (fs.existsSync(bibleFolderPath)) {
      const versionNumbers = fs.readdirSync(bibleFolderPath).filter((folder) => folder !== '.DS_Store'); // ex. v9
      const versionNumber = version || getLatestVersion(versionNumbers);
      const bibleVersionPath = path.join(bibleFolderPath, 'v' + versionNumber);
      const bookPath = path.join(bibleVersionPath, bookId);

      if (fs.existsSync(bookPath)) {
        return bibleVersionPath;
      } else {
        console.warn(`loadBookResource() - Bible path not found: ${bookPath}`);
      }
    } else {
      console.log('loadBookResource() - Directory not found, ' + bibleFolderPath);
    }
  } catch (error) {
    console.error(`loadBookResource() - Failed to load book. Bible: ${bibleId} Book: ${bookId} Language: ${languageId}`, error);
  }
  return null;
};

/**
 * load a book of the bible into resources
 * @return {Function}
 * @param resourceDetails
 */
export const loadResource = async (resourceDetails) => {
  let bibleDataPath = loadBookResource(resourceDetails.resourceId, resourceDetails.bookId, resourceDetails.languageId, resourceDetails.version);
  if (!bibleDataPath) { // if not found then download
    const sourceContentUpdater = new Updater();
    try {
      console.log(`Downloading resource ${JSON.stringify(resourceDetails)}`);
      await await sourceContentUpdater.downloadAndProcessResource(resourceDetails, USER_RESOURCES_PATH);
      bibleDataPath = loadBookResource(resourceDetails.resourceId, resourceDetails.bookId, resourceDetails.languageId, resourceDetails.version);
    } catch (e) {
      console.log(`could not download: ${JSON.stringify(resourceDetails)}`, e);
      bibleDataPath = null;
    }
  }
  return bibleDataPath;
};

/**
 * Loads the latest or an older version of the original based on tool requirements
 * language resource based on the tool & project combo.
 * @param projectPath
 * @param bookId
 * @param toolName
 */
export const loadOlderOriginalLanguageResource = async (projectPath, bookId, toolName) => {
  const {
    origLangId, origLangBibleId, latestOlVersion, tsvOLVersion,
  } = getOrigLangVersionInfoForTn(projectPath, bookId);

  // if version of current original language resource if not the one needed by the tn groupdata
  if (tsvOLVersion && (tsvOLVersion !== latestOlVersion) && toolName === TRANSLATION_NOTES) {
    // load original language resource that matches version number for tn groupdata
    console.log(`translationNotes requires original lang ${tsvOLVersion}`);
    const resourceDetails = {bookId, languageId: origLangId, resourceId: origLangBibleId, version: tsvOLVersion};
    return await loadResource(resourceDetails);
  } else {
    const resourceDetails = {bookId, languageId: origLangId, resourceId: origLangBibleId, version: latestOlVersion};
    return await loadResource(resourceDetails);
  }
};

/**
 * gets the data that the tool needs
 * @return {{resourceId, languageId, latestOlVersion, tsvOLVersion: (*|undefined)}}
 */
export function getOrigLangVersionInfoForTn(projectPath, bookId) {
  const {bibleId: origLangBibleId, languageId: origLangId} = getOrigLangforBook(bookId);
  const bibleFolderPath = path.join(USER_RESOURCES_PATH, origLangId, 'bibles', origLangBibleId);
  let latestOlVersion = null;

  if (fs.existsSync(bibleFolderPath)) {
    latestOlVersion = getMostRecentVersionInFolder(bibleFolderPath);

    if (latestOlVersion) {
      latestOlVersion = latestOlVersion.replace('v', ''); // strip off leading 'v'
    }
  }

  const tsvOLVersion = getCurrentOrigLangVersionForTn(projectPath, bookId);
  return {
    origLangId, origLangBibleId, latestOlVersion, tsvOLVersion,
  };
}

/**
 * Nested version of the books of the bible object.
 */
export const BIBLE_BOOKS = {
  oldTestament: {
    'gen': 'Genesis',
    'exo': 'Exodus',
    'lev': 'Leviticus',
    'num': 'Numbers',
    'deu': 'Deuteronomy',
    'jos': 'Joshua',
    'jdg': 'Judges',
    'rut': 'Ruth',
    '1sa': '1 Samuel',
    '2sa': '2 Samuel',
    '1ki': '1 Kings',
    '2ki': '2 Kings',
    '1ch': '1 Chronicles',
    '2ch': '2 Chronicles',
    'ezr': 'Ezra',
    'neh': 'Nehemiah',
    'est': 'Esther',
    'job': 'Job',
    'psa': 'Psalms',
    'pro': 'Proverbs',
    'ecc': 'Ecclesiastes',
    'sng': 'Song of Solomon',
    'isa': 'Isaiah',
    'jer': 'Jeremiah',
    'lam': 'Lamentations',
    'ezk': 'Ezekiel',
    'dan': 'Daniel',
    'hos': 'Hosea',
    'jol': 'Joel',
    'amo': 'Amos',
    'oba': 'Obadiah',
    'jon': 'Jonah',
    'mic': 'Micah',
    'nam': 'Nahum',
    'hab': 'Habakkuk',
    'zep': 'Zephaniah',
    'hag': 'Haggai',
    'zec': 'Zechariah',
    'mal': 'Malachi',
  },
  newTestament: {
    'mat': 'Matthew',
    'mrk': 'Mark',
    'luk': 'Luke',
    'jhn': 'John',
    'act': 'Acts',
    'rom': 'Romans',
    '1co': '1 Corinthians',
    '2co': '2 Corinthians',
    'gal': 'Galatians',
    'eph': 'Ephesians',
    'php': 'Philippians',
    'col': 'Colossians',
    '1th': '1 Thessalonians',
    '2th': '2 Thessalonians',
    '1ti': '1 Timothy',
    '2ti': '2 Timothy',
    'tit': 'Titus',
    'phm': 'Philemon',
    'heb': 'Hebrews',
    'jas': 'James',
    '1pe': '1 Peter',
    '2pe': '2 Peter',
    '1jn': '1 John',
    '2jn': '2 John',
    '3jn': '3 John',
    'jud': 'Jude',
    'rev': 'Revelation',
  },
};

/**
 * tests if book is a Old Testament book
 * @param bookId
 * @return {boolean}
 */
export function isOldTestament(bookId) {
  return bookId in BIBLE_BOOKS.oldTestament;
}

/**
 * determine Original Language and Original Language bible for book
 * @param bookId
 * @return {{resourceLanguage: string, bibleID: string}}
 */
export function getOrigLangforBook(bookId) {
  const isOT = isOldTestament(bookId);
  const languageId = (isOT) ? OT_ORIG_LANG : NT_ORIG_LANG;
  const bibleId = (isOT) ? OT_ORIG_LANG_BIBLE : NT_ORIG_LANG_BIBLE;
  return {languageId, bibleId};
}

/**
 * Get the content of an article from disk
 * @param {String} resourceType
 * @param {String} articleId
 * @param {String} languageId
 * @param {String} category - Category of the article, e.g. kt, other, translate, etc. Can be blank.
 * @returns {String} - the content of the article
 */
export const loadArticleData = (resourceType, articleId, languageId, category='') => {
  let articleData = '# Article Not Found: '+articleId+' #\n\nCould not find article for '+articleId;
  const articleFilePath = findArticleFilePath(resourceType, articleId, languageId, category);

  if (articleFilePath) {
    articleData = fs.readFileSync(articleFilePath, 'utf8'); // get file from fs
  }
  return articleData;
};

/**
 * Finds the article file within a resoure type's path, looking at both the given language and default language in all possible category dirs
 * @param {String} resourceType - e.g. translationWords, translationNotes
 * @param {String} articleId
 * @param {String} languageId - languageId will be first checked, and then we'll try the default GL
 * @param {String} category - the articles category, e.g. other, kt, translate. If blank we'll try to guess it.
 * @returns {String} - the path to the file, null if doesn't exist
 * Note: resourceType is coming from a tool name
 */
export const findArticleFilePath = (resourceType, articleId, languageId, category='') => {
  const languageDirs = [];

  if (languageId) {
    languageDirs.push(languageId);
  }

  if (languageId !== DEFAULT_GATEWAY_LANGUAGE) {
    languageDirs.push(DEFAULT_GATEWAY_LANGUAGE);
  }

  let categories = [];

  if (! category ) {
    if (resourceType === TRANSLATION_WORDS) {
      categories = ['kt', 'names', 'other'];
    } else if (resourceType === TRANSLATION_NOTES || resourceType === TRANSLATION_ACADEMY) {
      categories = ['translate', 'checking', 'process', 'intro'];
      resourceType = TRANSLATION_ACADEMY;
    } else {
      categories = ['content'];
    }
  } else {
    categories.push(category);
  }

  const articleFile = articleId + '.md';

  for (let i = 0, len = languageDirs.length; i < len; ++i) {
    let languageDir = languageDirs[i];
    let typePath = path.join(USER_RESOURCES_PATH, languageDir, TRANSLATION_HELPS, resourceType);
    let versionPath = getLatestVersion(typePath) || typePath;

    for (let j = 0, jLen = categories.length; j < jLen; ++j) {
      let categoryDir = categories[j];

      if (resourceType === TRANSLATION_WORDS) {
        categoryDir = path.join(categoryDir, 'articles');
      }

      let articleFilePath = path.join(versionPath, categoryDir, articleFile);

      if (fs.existsSync(articleFilePath)) {
        return articleFilePath;
      }
    }
  }
  return null;
};

export function addDupeCount(duplicateCount, bookCount, csvLines, book) {
  const percentDupes = Math.round(100 * duplicateCount / bookCount);
  csvLines.push(`${book}\t${bookCount}\t${duplicateCount}\t${percentDupes}`);
  console.log(`for ${book} the total is ${bookCount} with ${duplicateCount} duplicates or ${percentDupes}%`);
}

export function addCsvItem(list, org, repo, subject, item) {
  const itemJson = JSON.stringify(item).replace('\t','\\t');
  list.push({org, repo, subject, resource: itemJson});
  // list.push(`${org}\t${repo}\t${subject}\t${itemJson}`);
}

export function addCsvItem2(list, org, repo, subject, item, category) {
  const itemJson = JSON.stringify(item).replace('\t','\\t');
  list.push({category, org, repo, subject, resource: itemJson});
  // list.push(`${org}\t${repo}\t${subject}\t${itemJson}`);
}

export function writeCsv(filename, list) {
  const csvLines = [];
  for (const item of list) {
    const itemJson = JSON.stringify(item.resource).replace('\t', '\\t');
    csvLines.push(`${item.org}\t${item.repo}\t${item.subject}\t${itemJson}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n') + '\n', 'utf8');
}

export function writeCsv2(filename, list) {
  const csvLines = [];
  for (const item of list) {
    const itemJson = JSON.stringify(item.resource).replace('\t', '\\t');
    csvLines.push(`${item.category}\t${item.org}\t${item.repo}\t${item.subject}\t${itemJson}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n') + '\n', 'utf8');
}
