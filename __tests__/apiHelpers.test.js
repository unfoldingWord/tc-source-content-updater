import fs from 'fs-extra';
import path from 'path-extra';
import * as apiHelpers from '../src/helpers/apiHelpers';

jest.unmock('fs-extra');

const startPath = '/Users/blm/translationCore/resources/hi/translationHelps/translationNotes/v47.1';
const resource = 'hi_tn';
// const startPath = '/Users/blm/translationCore/resources/en/translationHelps/translationNotes/v54';
// const resource = 'en_tn';
// const startPath = '/Users/blm/translationCore/resources/el-x-koine/translationHelps/translationWords/v0.21';
// const resource = 'ugnt_tw';
// const startPath = '/Users/blm/translationCore/resources/hbo/translationHelps/translationWords/v2.1.21';
// const resource = 'hbo_tw';

describe('Examining Check', () => {
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
    const csvLines = [];
    let totalChecks = 0;
    let totalDuplicates = 0;
    csvLines.push(`Book\tNumber of Checks\tNumber of Duplicates\tPercent Duplicates`);
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
            duplicateCount += count;
          }
        }
        addDupeCount(duplicateCount, bookCount, csvLines, book);
        totalChecks += bookCount;
        totalDuplicates += duplicateCount;
      }
    }
    addDupeCount(totalDuplicates, totalChecks, csvLines, 'Total');
    const outputPath = `./${resource}-Duplicates.tsv`;
    fs.writeFileSync(outputPath, csvLines.join('\n') + '\n', 'utf8');
    console.log(`done - saved results to ${outputPath}`);
  });
});

describe('apiHelpers.getCatalog', () => {
  it('should get the resulting catalog', () => {
    return apiHelpers.getCatalog().then(res => {
      expect(res).toMatchObject({
        catalogs: expect.any(Array),
        subjects: expect.any(Array)
      });
      const items = res && res.subjects;
      console.log(`D43 Catalog returned ${items.length} total items`);
      const csvLines = [];
      const org = 'Door43-Catalog';
      for (const item of items) {
        const language = item.language;
        for (const resource of item.resources) {
          const resId = resource.identifier;
          const subject = resource.subject;
          const repo = `${language}_${resId}`;
          addCsvItem(csvLines, org, repo, subject, resource);
        }
      }
      console.log(`D43 Catalog flattened has ${csvLines.length} total items`);
      writeCsv('./CatalogOld.tsv', csvLines);
    });
  });
});

describe('apiHelpers compare pivoted.json with CN', () => {
  it('should make a merged CSV', async () => {
    const res = await apiHelpers.getCatalog();
    expect(res).toMatchObject({
      catalogs: expect.any(Array),
      subjects: expect.any(Array)
    });
    const items = res && res.subjects;
    console.log(`D43 Catalog returned ${items.length} total items`);
    const csvLines = [];
    const org = 'Door43-Catalog';
    const oldCatalog = 'Old';
    for (const item of items) {
      const language = item.language;
      for (const resource of item.resources) {
        const resId = resource.identifier;
        const subject = resource.subject;
        const repo = `${language}_${resId}`;
        addCsvItem2(csvLines, org, repo, subject, resource, oldCatalog);
      }
    }
    console.log(`D43 Catalog flattened has ${csvLines.length} total items`);
    writeCsv('./CatalogOld.tsv', csvLines);

    const latestD43Catalog = 'http://git.door43.org/api/catalog/v5?owner=Door43-Catalog&stage=latest';
    const data = await apiHelpers.doMultipartQuery(latestD43Catalog);
    console.log(`Catalog Next Found ${data.length} total items`);
    expect(data.length).toBeTruthy();
    const cnCatalog = 'CN';
    const cnCatalogCombined = 'CN+Old';
    for (const item of data) {
      const subject = item.subject;
      const repo = item.name;
      const org = item.owner;
      const pos = csvLines.findIndex(line => ((line.repo === repo) && (line.org === org)));
      if (pos >= 0) {
        const line = csvLines[pos];
        if (line.category === oldCatalog) {
          line.category = cnCatalogCombined;
        } else {
          console.log(JSON.stringify(line));
        }
      } else {
        addCsvItem2(csvLines, org, repo, subject, item, cnCatalog);
      }
    }

    writeCsv2('./Catalog-CN-and-Old.tsv', csvLines);
    console.log('done');

  }, 10000);
});

describe('apiHelpers.getCatalogCN', () => {
  it('should get the CN catalog', async () => {
    const filteredSearch = 'https://git.door43.org/api/catalog/v5/search?subject=Bible%2CAligned%20Bible%2CGreek_New_Testament%2CHebrew_Old_Testament%2CTranslation%20Words%2CTranslation%20Notes%2CTranslation%20Academy&sort=subject&limit=50';
    const unFilteredSearch = 'https://git.door43.org/api/catalog/v5/search?sort=subject&limit=50';
    // const latestD43Catalog = 'https://git.door43.org/api/catalog/v5/search/Door43-Catalog?stage=latest&limit=50';
    const latestD43Catalog = 'http://qa.door43.org/api/catalog/v5?owner=Door43-Catalog&stage=latest';
    const data = await apiHelpers.doMultipartQuery(unFilteredSearch);
    console.log(`Catalog Next Found ${data.length} total items`);
    expect(data.length).toBeTruthy();
    const orgs = {};
    for (let i = 0, l = data.length; i < l; i++) {
      const item = data[i];
      const org = item && item.repo && item.repo.owner && item.repo.owner.login || null;
      if (org) {
        if (!orgs[org]) {
          orgs[org] = [];
        }
        orgs[org].push(item);
      } else {
        console.log(`missing org in ${JSON.stringify(item)}`);
      }
    }
    const orgList = Object.keys(orgs);
    for (const org of orgList) {
      console.log(`${org} has ${orgs[org].length} items`);
    }

    let csvLines = [];
    const org = 'Door43-Catalog';
    getOrgItems(orgs, org, csvLines);
    console.log(`D43 Catalog flattened has ${csvLines.length} total items`);
    writeCsv('./CatalogCN-D43.tsv', csvLines);

    csvLines = [];
    for (const org of orgList) {
      getOrgItems(orgs, org, csvLines);
    }
    console.log(`Catalog Next flattened has ${csvLines.length} total items`);
    writeCsv('./CatalogCN.tsv', csvLines);
  });
}, 10000);

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

