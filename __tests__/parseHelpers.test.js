/* eslint-env jest */
import * as parseHelpers from '../src/helpers/parseHelpers'

const catalog = require('./fixtures/catalog');

describe('getTcResources()', () => {
  it('should succeed', () => {
    const results = parseHelpers.getTcResources(catalog);
    expect(results.length).toEqual(2);
  });
});
