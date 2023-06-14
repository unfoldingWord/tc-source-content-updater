/* eslint-disable curly */
import fs from 'fs-extra';
import path from 'path-extra';
import * as bible from '../../resources/bible';
import {isObject} from 'util';
// helpers
import * as resourcesHelpers from '../resourcesHelpers';
// constants
import * as errors from '../../resources/errors';

/**
 * @description Generates the tW Group Data files from the given aligned Bible
 * @param {Object} resource Resource object
 * @param {String} sourcePath Path to the Bible with aligned data
 * @param {String} outputPath Path where the translationWords group data is to be placed WITHOUT version
 * @return {Boolean} true if success
 */
export const generateTwGroupDataFromAlignedBible = (resource, sourcePath, outputPath) => {
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
  const version = resourcesHelpers.getVersionFromManifest(sourcePath);
  if (!version) {
    return false;
  }
  const books = resource.languageId === 'hbo' ? bible.BIBLE_LIST_OT.slice(0) : bible.BIBLE_LIST_NT.slice(0);
  books.forEach((bookName) => {
    convertBookVerseObjectsToTwData(sourcePath, outputPath, bookName);
  });
  return true;
};

/**
 *
 * @param {object} twData
 * @param {string} outputPath
 * @param {string} bookId
 */
function saveTwData(twData, outputPath, bookId) {
  for (const category in twData) {
    for (const groupId in twData[category]) {
      const groupPath = path.join(outputPath, category, 'groups', bookId, groupId + '.json');
      fs.outputFileSync(groupPath, JSON.stringify(twData[category][groupId], null, 2));
    }
  }
}

/**
 * @description Gets verseObjects of a book and converts to a tW data object to save to file
 * @param {String} sourcePath Usually path to the UGNT
 * @param {String} outputPath The output path for tW files
 * @param {String} bookName Book in format, e.g. '41-MAT'
 */
function convertBookVerseObjectsToTwData(sourcePath, outputPath, bookName) {
  const bookId = getbookId(bookName);
  const twData = {};
  const bookDir = path.join(sourcePath, bookId);
  if (fs.existsSync(bookDir)) {
    const chapters = Object.keys(bible.BOOK_CHAPTER_VERSES[bookId]).length;
    for (let chapter = 1; chapter <= chapters; chapter++) {
      const chapterFile = path.join(bookDir, chapter + '.json');
      if (fs.existsSync(chapterFile)) {
        const json = JSON.parse(fs.readFileSync(chapterFile));
        for (const verse in json) {
          const groupData = {};
          const words = [];
          for (let i = 0, l = json[verse].verseObjects.length; i < l; i++ ) {
            populateGroupDataFromVerseObject(groupData, json[verse].verseObjects[i], words);
          }
          populateTwDataFromGroupData(twData, groupData, bookId, chapter, verse);
        }
      }
    }
    saveTwData(twData, outputPath, bookId);
  }
}

/**
 * search for previous occurrences of word to get occurrence for this instance
 * @param {Array} wordObjects so far in current verse
 * @param {Object} verseObject
 * @return {number} occurrence of this word in verse
 */
function getWordOccurrence(wordObjects, verseObject) {
  let occurrence = 1;
  for (let i = 0, l = wordObjects.length; i < l; i++) {
    if (wordObjects[i] === verseObject.text) {
      occurrence++;
    }
  }
  return occurrence;
}

/**
 * @description Populates the groupData array with this verseObject and returns its own groupData for milestones
 * @param {Object} groupData Group Data object
 * @param {Object} verseObject Verse object
 * @param {Array} words - array of words already found
 * @param {Boolean} isMilestone If true, all word objects will be added to the group data
 * @return {Object} Returns group data for this verse object
 */
function populateGroupDataFromVerseObject(groupData, verseObject, words, isMilestone = false) {
  const myGroupData = {
    quote: [],
    strong: [],
    lemma: [],
  };
  const isWord = (verseObject.type === 'word');
  if (verseObject.type === 'milestone' || (isWord && (verseObject.tw || isMilestone))) {
    if (verseObject.type === 'milestone') {
      if (verseObject.text) {
        myGroupData.text.push(verseObject.text);
      }
      for (let i = 0, l = verseObject.children.length; i < l; i++) {
        const childVerseObject = verseObject.children[i];
        const childGroupData = populateGroupDataFromVerseObject(groupData, childVerseObject, words, true);
        if (childGroupData) {
          myGroupData.quote = myGroupData.quote.concat(childGroupData.quote);
          myGroupData.strong = myGroupData.strong.concat(childGroupData.strong);
          myGroupData.lemma = myGroupData.strong.concat(childGroupData.lemma);
        }
      }
    } else if (isWord) {
      myGroupData.quote.push({word: verseObject.text, occurrence: getWordOccurrence(words, verseObject)});
      myGroupData.strong.push(verseObject.strong);
      myGroupData.lemma.push(verseObject.lemma);
    }
    if (myGroupData.quote.length) {
      if (verseObject.tw) {
        const twLinkItems = verseObject.tw.split('/');
        const groupId = twLinkItems.pop();
        const category = twLinkItems.pop();
        if (!groupData[category]) {
          groupData[category] = {};
        }
        if (!groupData[category][groupId]) {
          groupData[category][groupId] = [];
        }
        groupData[category][groupId].push({
          quote: myGroupData.quote,
          strong: myGroupData.strong,
        });
      }
    }
  }
  if (isWord && verseObject.text) {
    words.push(verseObject.text); // keep track of words found so far in verse
  }
  return myGroupData;
}

/**
 * @description Takes what is in the groupData array and populates the tWData
 * @param {Object} twData Data to be collected for tw
 * @param {Object} groupData Group data object
 * @param {String} bookId Three character code for the book
 * @param {int} chapter Number of the chapter
 * @param {int} verse Number of the verse
 */
function populateTwDataFromGroupData(twData, groupData, bookId, chapter, verse) {
  for (const category in groupData) {
    if (!twData[category]) {
      twData[category] = [];
    }
    let quote = null;
    let occurrence = 0;
    for (const groupId in groupData[category]) {
      if (!twData[category][groupId]) {
        twData[category][groupId] = [];
      }
      for (let i = 0, l = groupData[category][groupId].length; i < l; i++) {
        const item = groupData[category][groupId][i];
        if (item.quote.length > 1) {
          quote = item.quote;
          occurrence = 1;
        } else { // if only one word in quote
          const firstQuote = item.quote[0];
          quote = firstQuote.word;
          occurrence = firstQuote.occurrence;
        }
        twData[category][groupId].push({
          priority: 1,
          comments: false,
          reminders: false,
          selections: false,
          verseEdits: false,
          nothingToSelect: false,
          contextId: {
            reference: {
              bookId: bookId,
              chapter: chapter,
              verse: parseInt(verse),
            },
            tool: 'translationWords',
            groupId: groupId,
            quote,
            strong: item.strong,
            lemma: item.lemma,
            occurrence,
          },
        });
      }
    }
  }
}

/**
 * @description Splits book code out of book name, for example 'mat' from '41-MAT'
 * @param {String} bookName Book in format '41-MAT'
 * @return {String} The book ID, e.g. 'mat'
 */
function getbookId(bookName) {
  return bookName.split('-')[1].toLowerCase();
}
