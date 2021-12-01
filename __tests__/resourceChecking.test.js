import fs from 'fs-extra';
import path from 'path-extra';
import {makeRequestDetailed} from '../src/helpers/apiHelpers';
import {BIBLE_LIST_NT, BIBLE_LIST_OT} from '../src/resources/bible';

jest.unmock('fs-extra');

describe('Examining Checks in Repo', () => {
  it('Check TSV', async () => {
    // const repo_url = 'https://git.door43.org/Door43-Catalog/en_tn/raw/branch/master/en_tn_62-2PE.tsv';
    const owner = 'Door43-Catalog';
    const repo = 'kn_tn';
    const repoUrl = `https://git.door43.org/${owner}/${repo}`;
    const bookList = BIBLE_LIST_OT.concat(BIBLE_LIST_NT);
    const uniqueChecks = {};

    for (const book of bookList) {
      console.log(`loading book ${book}`);
      const [, bookId] = book.split('-');
      if (!uniqueChecks[bookId]) {
        uniqueChecks[bookId] = {};
      }
      const bookChecks = uniqueChecks[bookId];
      const bookUrl = `${repoUrl}/raw/branch/master/${repo}_${book}.tsv`;
      try {
        const {response, body} = await makeRequestDetailed(bookUrl);
        const lines = body.split('\n');
        for (let i = 1, l = lines.length; i < l; i++) {
          const line = lines[i];
          if (line) {
            const fields = line.split('\t');
            const [ bookId, chapter, verse, id, supportRef, origQuote, occurrence, glQuote, occurrenceNote ] = fields;
            if (occurrenceNote && origQuote && supportRef) {
              const key = `${chapter}-${verse}-${supportRef}`;
              if (!bookChecks[key]) {
                bookChecks[key] = 1;
              } else {
                bookChecks[key]++;
              }
            } else {
              // console.log(`skipping ${line}`);
            }
          }
        }
        console.log(`book processed: ${book}`);
      } catch (e) {
        console.log(`file ${bookUrl} is not found`, e);
      }
    }

    console.log(`\n\nDuplicates in repo: ${repoUrl}`);
    const duplicateCountLines = [];
    const duplicateLines = [];
    let totalChecks = 0;
    let totalDuplicates = 0;
    duplicateCountLines.push(`Book\tNumber of Checks\tNumber of Duplicates\tPercent Duplicates`);
    duplicateLines.push(`Book\tCheck\tNumber of Duplicates`);
    const books = Object.keys(uniqueChecks);
    for (const book of books) {
      const bookChecks = uniqueChecks[book];
      const checks = Object.keys(bookChecks);

      if (checks.length) {
        let bookCount = 0;
        let duplicateCount = 0;
        for (const check of checks) {
          const count = bookChecks[check];
          bookCount += count;
          if (count > 1) {
            duplicateLines.push(`${book}\t${check}\t${count}`);
            duplicateCount += count;
          }
        }
        addDupeCount(duplicateCount, bookCount, duplicateCountLines, book);
        totalChecks += bookCount;
        totalDuplicates += duplicateCount;
      }
    }
    addDupeCount(totalDuplicates, totalChecks, duplicateCountLines, 'Total');
    const duplicateCountPath = `./${owner}_${repo}_DuplicateCounts.tsv`;
    fs.writeFileSync(duplicateCountPath, duplicateCountLines.join('\n') + '\n', 'utf8');
    const duplicatesPath = `./${owner}_${repo}_Duplicates.tsv`;
    fs.writeFileSync(duplicatesPath, duplicateLines.join('\n') + '\n', 'utf8');
    console.log(`done - saved results to ${duplicateCountPath}`);
  },60000);
});

// const startPath = '/Users/blm/translationCore/resources/hi/translationHelps/translationNotes/v47.1';
// const resource = 'hi_tn';
const startPath = '/Users/blm/translationCore/resources/en/translationHelps/translationNotes/v54';
const resource = 'en_tn';
// const startPath = '/Users/blm/translationCore/resources/el-x-koine/translationHelps/translationWords/v0.21';
// const resource = 'ugnt_tw';
// const startPath = '/Users/blm/translationCore/resources/hbo/translationHelps/translationWords/v2.1.21';
// const resource = 'hbo_tw';

describe('Examining Checks in File System', () => {
  it('Look for duplicates', () => {
    const uniqueChecks = {};
    const catagories = fs.readdirSync(startPath);
    for (const catagory of catagories) {
      const catagoryPath = path.join(startPath, catagory);
      if (fs.statSync(catagoryPath).isDirectory()) {
        const booksPath = path.join(catagoryPath, 'groups');
        const books = fs.readdirSync(booksPath);
        for (const book of books) {
          if (!uniqueChecks[book]) {
            uniqueChecks[book] = {};
          }
          const bookChecks = uniqueChecks[book];
          const bookPath = path.join(booksPath, book);
          if (fs.statSync(bookPath).isDirectory()) {
            const groupIds = fs.readdirSync(bookPath);
            for (const groupIdFile of groupIds) {
              const groupIdPath = path.join(bookPath, groupIdFile);
              const checkArray = fs.readJsonSync(groupIdPath);
              for (const check of checkArray) {
                const key = `${check.contextId.reference.chapter}-${check.contextId.reference.verse}-${check.contextId.groupId}`;
                if (!bookChecks[key]) {
                  bookChecks[key] = 1;
                } else {
                  bookChecks[key]++;
                }
              }
            }
          }
          console.log(`book = ${book}`);
        }
        console.log(`catagory = ${catagory}`);
      }
    }
    console.log(`\n\nIn folder: ${startPath}`);
    const duplicateCountLines = [];
    const duplicateLines = [];
    let totalChecks = 0;
    let totalDuplicates = 0;
    duplicateCountLines.push(`Book\tNumber of Checks\tNumber of Duplicates\tPercent Duplicates`);
    duplicateLines.push(`Book\tCheck\tNumber of Duplicates`);
    const books = Object.keys(uniqueChecks);
    for (const book of books) {
      const bookChecks = uniqueChecks[book];
      const checks = Object.keys(bookChecks);

      if (checks.length) {
        let bookCount = 0;
        let duplicateCount = 0;
        for (const check of checks) {
          const count = bookChecks[check];
          bookCount += count;
          if (count > 1) {
            duplicateLines.push(`${book}\t${check}\t${count}`);
            duplicateCount += count;
          }
        }
        addDupeCount(duplicateCount, bookCount, duplicateCountLines, book);
        totalChecks += bookCount;
        totalDuplicates += duplicateCount;
      }
    }
    addDupeCount(totalDuplicates, totalChecks, duplicateCountLines, 'Total');
    const duplicateCountPath = `./${resource}-DuplicateCounts.tsv`;
    fs.writeFileSync(duplicateCountPath, duplicateCountLines.join('\n') + '\n', 'utf8');
    const duplicatesPath = `./${resource}-Duplicates.tsv`;
    fs.writeFileSync(duplicatesPath, duplicateLines.join('\n') + '\n', 'utf8');
    console.log(`done - saved results to ${duplicateCountPath}`);
  });
});

//
// helpers
//

function addDupeCount(duplicateCount, bookCount, csvLines, book) {
  const percentDupes = Math.round(100 * duplicateCount / bookCount);
  csvLines.push(`${book}\t${bookCount}\t${duplicateCount}\t${percentDupes}`);
  console.log(`for ${book} the total is ${bookCount} with ${duplicateCount} duplicates or ${percentDupes}%`);
}

function addCsvItem(list, org, repo, subject, item) {
  const itemJson = JSON.stringify(item).replace('\t','\\t');
  list.push({org, repo, subject, resource: itemJson});
  // list.push(`${org}\t${repo}\t${subject}\t${itemJson}`);
}

function addCsvItem2(list, org, repo, subject, item, category) {
  const itemJson = JSON.stringify(item).replace('\t','\\t');
  list.push({category, org, repo, subject, resource: itemJson});
  // list.push(`${org}\t${repo}\t${subject}\t${itemJson}`);
}

function writeCsv(filename, list) {
  const csvLines = [];
  for (const item of list) {
    const itemJson = JSON.stringify(item.resource).replace('\t', '\\t');
    csvLines.push(`${item.org}\t${item.repo}\t${item.subject}\t${itemJson}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n') + '\n', 'utf8');
}

function writeCsv2(filename, list) {
  const csvLines = [];
  for (const item of list) {
    const itemJson = JSON.stringify(item.resource).replace('\t', '\\t');
    csvLines.push(`${item.category}\t${item.org}\t${item.repo}\t${item.subject}\t${itemJson}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n') + '\n', 'utf8');
}

function getOrgItems(orgs, org, csvLines) {
  const items = orgs[org];
  for (const item of items) {
    const subject = item.subject;
    const repo = item.name;
    const org = item.owner;
    addCsvItem(csvLines, org, repo, subject, item);
  }
}

