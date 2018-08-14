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
    const results = parseHelpers.getTcoreResources(catalog, ['Greek_New_Testament']);
    expect(results.length).toEqual(1);
    expect(results[0].languageId).toEqual('grc');
  });
});

describe('getLatestResources()', () => {
  it('should succeed', () => {
    const resourceList = [
      {languageId: 'fr', resourceId: 'f10', modifiedTime: '2101-04-27T18:51:27+00:00'}
    ];
    const results = parseHelpers.getLatestResources(catalog, resourceList);
    expect(results.length).toEqual(70);

    const greekIndex = results.findIndex(lang => (lang.languageId === 'grc'));
    expect(greekIndex).toBeGreaterThanOrEqual(0);
  });
});
