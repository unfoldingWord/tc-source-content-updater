/* eslint-env jest */
/* eslint-disable camelcase,no-empty */
import * as parseHelpers from '../src/helpers/parseHelpers'

const catalog = require('./fixtures/catalog');

describe('getTcoreResources()', () => {
  it('should succeed', () => {
    const results = parseHelpers.getTcoreResources(catalog);
    expect(results.length).toEqual(2);
    expect(results[0].lang_code).toEqual('fr');
    expect(results[1].lang_code).toEqual('grc');
  });
});

describe('getLatestResources()', () => {
  it('should succeed', () => {
    const resourceList = [
      {lang_code: 'fr', bible_id: 'f10', modified_time: '2101-04-27T18:51:27+00:00'}
    ];
    const results = parseHelpers.getLatestResources(catalog, resourceList);
    expect(results.length).toEqual(1);
    expect(results[0].lang_code).toEqual('grc');
  });
});
