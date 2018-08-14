/* eslint-env jest */
/* eslint-disable camelcase,no-empty */
import * as parseHelpers from '../src/helpers/parseHelpers';

const catalog = require('./fixtures/catalog');

describe('parseCatalogResources()', () => {
  it('should find Bibles', () => {
    const results = parseHelpers.parseCatalogResources(catalog, ['Bible']);
    expect(results.length).toEqual(38);
  });
  it('should find Greek OL', () => {
    const results = parseHelpers.parseCatalogResources(catalog, ['Greek_New_Testament']);
    expect(results.length).toEqual(1);
    expect(results[0].languageId).toEqual('grc');
  });
});

describe('getLatestResources()', () => {
  it('should succeed with empty resourceList', () => {
    const resourceList = [];
    const results = parseHelpers.getLatestResources(catalog, resourceList);
    expect(results.length).toEqual(71);

    const greekResources = getResourcesForLanguageAndResource(results, 'grc');
    expect(greekResources.length).toEqual(1);

    const frenchResources = getResourcesForLanguageAndResource(results, 'fr');
    expect(frenchResources.length).toEqual(2);
  });

  it('should remove french/f10 since already up to date', () => {
    const resourceList = [
      {languageId: 'fr', resourceId: 'f10', modifiedTime: '2101-04-27T18:51:27+00:00'}
    ];
    const results = parseHelpers.getLatestResources(catalog, resourceList);
    expect(results.length).toEqual(70);

    const greekResources = getResourcesForLanguageAndResource(results, 'grc');
    expect(greekResources.length).toEqual(1);

    const frenchResources = getResourcesForLanguageAndResource(results, 'fr', 'f10');
    expect(frenchResources.length).toEqual(0);
  });
});

describe('getResourcesForLanguage()', () => {
  const resources = parseHelpers.getLatestResources(catalog, []);

  it('should find grc', () => {
    const greekResources = parseHelpers.getResourcesForLanguage(resources, 'grc');
    expect(greekResources.length).toEqual(1);
  });

  it('should return empty list for language not found', () => {
    const greekResources = parseHelpers.getResourcesForLanguage(resources, 'zzz');
    expect(greekResources.length).toEqual(0);
  });

  it('should return null if no resources', () => {
    const greekResources = parseHelpers.getResourcesForLanguage(null, 'grc');
    expect(greekResources).toBeNull();
  });
});

//
// helpers
//

/**
 * filter the resources on languageId and resourceId
 * @param {Array.<Object>} resources - list of resources to filter
 * @param {String} languageId - optional language to filter on
 * @param {String} resourceId - optional resource to filer on
 * @return {*} filtered array of resources
 */
export function getResourcesForLanguageAndResource(resources, languageId, resourceId) {
  if (!resources) {
    return null;
  }
  return resources.filter(resource =>
    !languageId || (resource.languageId === languageId) &&
    !resourceId || (resource.resourceId === resourceId)
  );
}
