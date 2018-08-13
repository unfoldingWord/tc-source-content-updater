/* eslint-env jest */
/* eslint-disable camelcase,no-empty */
import * as parseHelpers from '../src/helpers/parseHelpers'

const catalog = require('./fixtures/catalogPivoted');

describe('getTcoreResources()', () => {
  it('should find Bibles', () => {
    const results = parseHelpers.getTcoreResources(catalog, ['Bible']);
    expect(results.length).toEqual(38);
  });
  it('should find Greek OL', () => {
    const results = parseHelpers.getTcoreResources(catalog, ['Greek New Testament']);
    expect(results.length).toEqual(1);
    expect(results[0].lang_code).toEqual('grc');
  });
});

describe('getLatestResources()', () => {
  it('should succeed', () => {
    const resourceList = [
      {lang_code: 'fr', bible_id: 'f10', modified_time: '2101-04-27T18:51:27+00:00'}
    ];
    const results = parseHelpers.getLatestResources(catalog, resourceList);
    expect(results.languages.length).toEqual(30);
    expect(results.resources.length).toEqual(38);

    const greekIndex = results.languages.findIndex(lang => (lang.lang_code === 'grc'));
    expect(greekIndex).toBeGreaterThanOrEqual(0);
  });
});
