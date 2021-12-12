// this is just a development playbox
// for Project Validation - search, download, and validate projects

import fs from 'fs-extra';
import path from 'path-extra';
import os from 'os';
import semver from 'semver';
import rimraf from 'rimraf';
// import nock from 'nock';
import isEqual from 'deep-equal';
import _ from 'lodash';
import * as apiHelpers from '../src/helpers/apiHelpers';
import Updater from '../src';
import {getSubdirOfUnzippedResource, unzipResource} from '../src/helpers/resourcesHelpers';
import {download} from '../src/helpers/downloadHelpers';
import {NT_ORIG_LANG, NT_ORIG_LANG_BIBLE, OT_ORIG_LANG, OT_ORIG_LANG_BIBLE} from '../src/resources/bible';
import {compareVersions, getLatestVersion} from "./apiHelpers.test";

// require('os').homedir()

jest.unmock('fs-extra');
jest.unmock('../src/helpers/downloadHelpers');
jest.unmock('../src/helpers/zipFileHelpers');

const HOME_DIR = os.homedir();
const USER_RESOURCES_PATH = path.join(HOME_DIR, 'translationCore/resources');
export const QUOTE_MARK = '\u2019';

// // disable nock failed
// nock.restore();
// nock.cleanAll();

describe('test project', () => {
  it('search, download and verify projects in org', async () => {
    // const org = 'India_BCS';
    // const langId = 'hi';
    // const org = 'TC_SAVE';
    // const langId = '%25'; // match all languages
    // const org = 'tCore-test-data';
    // const langId = '%25'; // match all languages
    // const org = 'Amos.Khokhar';
    // const langId = '%25'; // match all languages
    const org = null; // all orgs
    const langId = 'hi';

    const checkMigration = true;
    const resourcesPath = './temp/downloads';
    const outputFolder = './temp/tc_repos';
    let searchUrl = `https://git.door43.org/api/v1/repos/search?q=${langId}%5C_%25%5C_%25%5C_book&sort=id&order=asc&limit=50`;
    if (org) {
      searchUrl += `&owner=${org}`;
    }
    console.log(`Searching for lang ${langId}, org ${org}`);
    const repos = await apiHelpers.doMultipartQuery(searchUrl);
    console.log(`found ${repos.length} projects`);
    await validateProjects(repos, resourcesPath, outputFolder, langId, org, checkMigration);
  }, 50000000);

  it('summarizeProjects', () => {
    // const org = 'India_BCS';
    // const langId = 'hi';
    // const org = 'TC_SAVE';
    // const langId = '%25'; // match all languages
    // const org = 'tCore-test-data';
    // const langId = '%25'; // match all languages
    // const org = 'Amos.Khokhar';
    // const langId = '%25'; // match all languages
    const org = null; // all orgs
    const langId = 'hi';
    const outputFolder = './temp/tc_repos';
    summarizeProjects(outputFolder, langId, org);
  }, 50000000);

  it('download and verify project', async () => {
    const fullName = 'India_BCS/hi_hglt_1ti_book';
    const langId = 'hi';
    const resource = getResource(fullName, langId);
    const resourcesPath = './temp/downloads';
    try {
      const results = await downloadAndVerifyProject(resource, resourcesPath, fullName);
      console.log(results);
    } catch (e) {
      console.log(`Error downloading ${fullName}`, e);
    }
  }, 1000000);

  it('verify Alignments', async () => {
    const projectsPath = path.join(HOME_DIR, `translationCore/projects`);
    const projects = fs.readdirSync(projectsPath);
    for (const project of projects) {
      const results = verifyAlignments(project, projectsPath);
      console.log(JSON.stringify(percentCompleted));
    }
  });

  it('verify Checks', async () => {
    const projectsPath = path.join(HOME_DIR, `translationCore/projects`);
    const projects = fs.readdirSync(projectsPath);
    for (const project of projects) {
      const results = await verifyChecks(projectsPath, project);
      console.log(JSON.stringify(percentCompleted));
    }
  });
});

describe.skip('apiHelpers searching for books', () => {
  const outputFolder = './temp/tc_repos';
  const bookIds = ['rut', 'jon', 'est', 'ezr', 'neh', 'oba', 'luk', 'eph', '1ti', '2ti', 'tit', 'jas', '1jn', '2jn', '3jn'];

  for (const book of bookIds) {
    it(`find tC repos for ${book}`, async () => {
      const resourceId = book;
      console.log(`searching for book ${resourceId}`);
      fs.ensureDirSync(outputFolder);
      const searchUrl = `https://git.door43.org/api/v1/repos/search?q=%5C_${resourceId}%5C_book&sort=updated&order=desc&limit=50`;
      const repos = await apiHelpers.doMultipartQuery(searchUrl);
      console.log(`Search Found ${repos.length} total items`);
      const langRepos = {};
      for (const repo of repos) {
        const [languageId] = repo.name.split('_');
        if (!langRepos[languageId]) {
          langRepos[languageId] = [];
        }
        langRepos[languageId].push(repo);
      }
      const outputFile = path.join(outputFolder, `${resourceId}-repos.json`);
      fs.outputJsonSync(outputFile, langRepos);
    }, 50000);
  }

  it(`find tC repos for language`, async () => {
    const langList = {};
    const orgList = {};
    const files = getDirJson(outputFolder);
    for (const file of files) {
      // const [bookId] = file.split('-');
      const filePath = path.join(outputFolder, file);
      const data = fs.readJsonSync(filePath);
      // console.log(data);
      const langs = Object.keys(data);
      for (const langId of langs) {
        if (!langList[langId]) {
          langList[langId] = [];
        }
        if (!orgList[langId]) {
          orgList[langId] = {};
        }
        const newList = langList[langId].concat(data[langId]);
        for (const item of data[langId]) {
          const org = item.owner.login;
          if (!orgList[langId][org]) {
            orgList[langId][org] = 0;
          }
          orgList[langId][org]++;
        }
        langList[langId] = newList;
      }
    }
    const dataFolder = path.join(outputFolder, 'orgs');
    fs.outputJsonSync(path.join(dataFolder, `$orgs.json`), orgList);
    fs.outputJsonSync(path.join(dataFolder, 'langRepos.json'), langList);
  });
});

//
// helpers
//

/**
 *
 * @param fullName
 * @param langId
 * @return {null|any|any}
 */
function getResource(fullName, langId) {
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
function getDirJson(indexPath_) {
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
function verifyAlignments(project, projectsPath) {
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
async function verifyChecks(projectsPath, project, checkMigration) {
  const projectPath = path.join(projectsPath, project);
  const [langId, projectId, bookId] = project.split('_');
  let results = null;
  let origLangResourcePath;
  let tnResourceGl;
  if (fs.lstatSync(projectPath).isDirectory()) {
    if (checkMigration) {
      if (fs.existsSync(USER_RESOURCES_PATH)) {
        origLangResourcePath = await loadOlderOriginalLanguageResource(projectPath, bookId, TRANSLATION_NOTES);
        if (!origLangResourcePath) {
          console.error('error downloading original language');
          checkMigration = false;
        } else {
          const {toolsSelectedGLs} = getProjectManifest(projectPath);
          tnResourceGl = toolsSelectedGLs && toolsSelectedGLs.translationNotes;
        }
      } else {
        console.log(`resource folder not found: ${USER_RESOURCES_PATH}`);
      }
    }
    results = {langId, projectId, bookId};
    if (bookId) {
      const projectPath = path.join(projectsPath, project);
      const tools = ['translationNotes', 'translationWords'];
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
        const stats = getUniqueChecks(projectsPath, project, tool, origLangResourcePath, tnResourceGl);
        if (stats) {
          results[tool] = {
            ...results[tool],
            stats,
          };
        }
      }
    }
  }

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
async function downloadAndVerifyProject(resource, resourcesPath, fullName, checkMigration) {
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
    const message = `could not download ${resource.full_name}: ${e.toString()}`;
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
  }
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
  const key = `${checkId || ''}-${chapter}-${verse}-${groupId}-${occurrence}`;
  return key;
}

/**
 *
 * @param projectsPath
 * @param project
 * @param toolName
 * @param origLangResourcePath
 * @param tnResourceGl
 * @return {{dupes: {}, toolWarnings: string}}
 */
function getUniqueChecks(projectsPath, project, toolName, origLangResourcePath, tnResourceGl) {
  const uniqueChecks = {};
  const dupes = {};
  let migrations = {};
  let toolWarnings = '';
  const version = path.base(origLangResourcePath);
  let helpsPath;
  if (toolName === TRANSLATION_NOTES) {
    helpsPath = path.join(origLangResourcePath, '../../../..', tnResourceGl, 'translationHelps', TRANSLATION_NOTES);
    helpsPath = getLatestVersion(helpsPath);
  } else {
    helpsPath = path.join(origLangResourcePath, '../../../translationHelps', toolName, version);
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
            let dupeSelections = 0;
            for (let i = 0; i < selections.length - 1; i++) {
              for (let j = i + 1; j < selections.length; j++) {
                if (isEqual(selections[i], selections[j])) {
                  dupeSelections++;
                }
              }
            }
            if (dupeSelections) {
              warnings += `${dupeSelections} selections duplicated\t`;
            }
          }
        }
        if (warnings) {
          toolWarnings += `${key_} - ${warnings}\n`;
        }
        const dupesList = uniqueCheck.map((item) => (Array.isArray(item.selections) ? item.selections.map((item) => (`${item.text}-${item.occurrence}`)).join(' ') : (item.selections || '').toString()));
        dupes[key_] = {
          dupesList,
          warnings,
        };
      }
    }
    migrations = validateMigrations(projectsPath, bookId, toolName, uniqueChecks, helpsPath);
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
 * @param outputFolder
 * @param langId
 * @param org
 * @return {Promise<void>}
 */
function summarizeProjects(outputFolder, langId, org) {
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

    const resposLines = [];
    const lines = [];

    const projectNames = Object.keys(projectResults);
    const repoLine = {};
    for (const projectName of projectNames) {
      const project = projectResults[projectName];
      repoLine.fullName = project.fullName;
      repoLine.waPercentComplete = 0;
      repoLine.twPercentComplete = 0;
      repoLine.tnPercentComplete = 0;
      if (project.wA) {
        repoLine.waPercentComplete = project.wA.percentCompleted || 0;
        repoLine.twPercentComplete = 0;
        repoLine.tnPercentComplete = 0;
        if (project.checks) {
          repoLine.twPercentComplete = project.checks.translationWords && project.checks.translationWords.percentCompleted || 0;
          repoLine.tnPercentComplete = project.checks.translationNotes && project.checks.translationNotes.percentCompleted || 0;
        }
        repoLine.waPercentComplete = Math.round(repoLine.waPercentComplete*100);
        repoLine.twPercentComplete = Math.round(repoLine.twPercentComplete*100);
        repoLine.tnPercentComplete = Math.round(repoLine.tnPercentComplete*100);
      }
      resposLines.push(repoLine)
    }
    const reposFormat = [
      {
        key: 'fullName',
        text: 'Project'
      },
      {
        key: `waPercentComplete`,
        text: "wA % Done"
      },
      {
        key: `twPercentComplete`,
        text: "tW % Done"
      },
      {
        key: `tnPercentComplete`,
        text: "tN % Done"
      },
    ]
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
async function validateProjects(repos, resourcesPath, outputFolder, langId, org, checkMigration) {
  let projectResults = {};
  const summaryFile = path.join(outputFolder, 'orgs-pre', `${langId}-${org}-repos.json`);
  if (fs.existsSync(summaryFile)) {
    const summary = fs.readJsonSync(summaryFile);
    if (summary && summary.projects) {
      projectResults = summary.projects;
    }
  }
  for (let i = repos.length - 1; i > 0; i--) {
    const project = repos[i];
    if (projectResults[project.full_name]) {
      if (checkMigration) {
        if (projectResults[project.full_name].checkMigration) {
          console.log(`skipping over ${project} already migration checked`);
          continue; // skip over if repo already checked migration
        }
      } else {
        console.log(`skipping over ${project} since no migration checking`);
        continue; // skip over if repo already processed
      }
    }
    console.log(`${i+1} - Loading ${project.full_name}`);
    const results = await downloadAndVerifyProject(project, resourcesPath, project.full_name, checkMigration);
    if (results && results.wA && results.checks && (results.wA.warnings || results.checks.translationNotes.stats.toolWarnings || results.checks.translationWords.stats.toolWarnings)) {
      const projectWarnings = `warnings: WA: ${results.wA.warnings}, TN: ${results.checks.translationNotes.stats.toolWarnings}, TW: ${results.checks.translationWords.stats.toolWarnings}`;
      console.log(projectWarnings);
      results.projectWarnings = projectWarnings;
    }
    // console.log(JSON.stringify(results));
    projectResults[project.full_name] = results;
    const totalProjects = repos.length;
    const processedProjects = repos.length - i + 1;

    const summary = {
      processedProjects,
      totalProjects,
      projects: projectResults,
    };
    fs.outputJsonSync(summaryFile, summary);
  }

  const projectNames = Object.keys(projectResults);
  const waFinished = {};
  const waNearlyFinished = {};
  const allFinished = {};
  const allNearlyFinished = {};
  for (const projectName of projectNames) {
    try {
      const project = projectResults[projectName];
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
      if (!projectResults[projectName]) {
        projectResults[projectName] = {};
      }
      projectResults[projectName].projectWarnings = projectWarnings;
    }
  }
  const results = {
    projectSummaries: projectResults,
    goodProjects: {
      waFinished,
      waNearlyFinished,
      allFinished,
      allNearlyFinished,
    },
  };

  const outputFile = path.join(outputFolder, 'orgs', `${langId}-${org}-repos.json`);
  fs.outputJsonSync(outputFile, results);
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

const TRANSLATION_NOTES = 'translationNotes';

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
