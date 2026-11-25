import nock from 'nock';
import Updater, {SUBJECT, STAGE} from '../src';
import {DCS_BASE_URL} from '../src/helpers/apiHelpers';

const SEARCH_PATH = '/api/v1/catalog/search';

/**
 * make a minimal Catalog Next search result entry
 * @param {string} owner
 * @param {string} language
 * @param {string} resourceId
 * @param {string} version
 * @return {object}
 */
function makeAlignedBibleEntry(owner, language, resourceId, version) {
  const name = `${language}_${resourceId}`;
  return {
    name,
    owner,
    full_name: `${owner}/${name}`,
    language,
    subject: 'Aligned Bible',
    stage: 'prod',
    branch_or_tag_name: `v${version}`,
    release: {tag_name: `v${version}`},
    zipball_url: `${DCS_BASE_URL}/${owner}/${name}/archive/v${version}.zip`,
    released: '2023-01-01T00:00:00Z',
    repo: {checking_level: '3'},
  };
}

const PAGE_1 = [
  makeAlignedBibleEntry('unfoldingWord', 'en', 'ult', '45'),
  makeAlignedBibleEntry('unfoldingWord', 'en', 'ust', '45'),
  makeAlignedBibleEntry('Door43-Catalog', 'hi', 'irv', '1'),
];
const PAGE_2 = [
  makeAlignedBibleEntry('es-419_gl', 'es-419', 'glt', '12'),
  makeAlignedBibleEntry('ru_gl', 'ru', 'rlob', '3'),
];
const TOTAL_COUNT = PAGE_1.length + PAGE_2.length;

/**
 * get sorted list of unique language IDs from search results
 * @param {object[]} items
 * @return {string[]}
 */
function getLanguages(items) {
  return [...new Set(items.map((item) => item.languageId))].sort();
}

describe('searchCatalogNext for aligned bibles', () => {
  let requestedQueries;

  beforeEach(() => {
    requestedQueries = [];
    nock.cleanAll();
    nock(DCS_BASE_URL)
      .get(SEARCH_PATH)
      .query((query) => {
        requestedQueries.push(query);
        return true;
      })
      .times(2)
      .reply(function(uri) {
        const page = new URL(uri, DCS_BASE_URL).searchParams.get('page');
        const data = page === '1' ? PAGE_1 : PAGE_2;
        return [200, JSON.stringify({ok: true, data}), {'X-Total-Count': `${TOTAL_COUNT}`}];
      });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('returns the list of languages that have aligned bibles', async () => {
    // given
    const updater = new Updater();
    const searchParams = {
      subject: SUBJECT.ALIGNED_BIBLES,
      stage: STAGE.PROD,
    };
    const expectedLanguages = ['en', 'es-419', 'hi', 'ru'];

    // when
    const items = await updater.searchCatalogNext(searchParams, 1);
    const languages = getLanguages(items);

    // then
    expect(requestedQueries.length).toEqual(2); // fetched both pages
    expect(requestedQueries[0]).toMatchObject({
      subject: 'Aligned Bible',
      stage: 'prod',
      metadataType: 'rc',
      page: '1',
    });
    expect(requestedQueries[1].page).toEqual('2');
    expect(items.length).toEqual(TOTAL_COUNT);
    expect(items.every((item) => item.subject === 'Aligned_Bible')).toBeTruthy();
    expect(languages).toEqual(expectedLanguages);
  });

  it('returns null if search fails', async () => {
    // given
    nock.cleanAll();
    nock(DCS_BASE_URL).get(SEARCH_PATH).query(true).reply(500);
    const updater = new Updater();

    // when
    const items = await updater.searchCatalogNext({subject: SUBJECT.ALIGNED_BIBLES}, 1);

    // then
    expect(items).toBeNull();
  });
});
