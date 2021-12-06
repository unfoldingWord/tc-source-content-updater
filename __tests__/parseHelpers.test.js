/* eslint-env jest */
/* eslint-disable camelcase,no-empty */
import * as parseHelpers from '../src/helpers/parseHelpers';
import * as ERROR from '../src/resources/errors';
import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from 'constants';

const catalog = require('./fixtures/catalog');

describe.skip('parseCatalogResources()', () => {
  it('should find Bibles', () => {
    const results = parseHelpers.parseCatalogResources(catalog, true, ['Bible']);
    expect(results.length).toEqual(38);
  });

  it('All language Ids are lower case', () => {
    const results = parseHelpers.parseCatalogResources(catalog, true, ['Bible']);
    const re = /^[-a-z0-9]*$/; // dash is allowed

    for( let idx = 0; idx < results.length; idx++) {
      //console.log( "results.languageId: ", results[idx].languageId );
      expect(results[idx].languageId).toEqual(expect.stringMatching(re));
    }
  });

  it('should find Greek OL', () => {
    const results = parseHelpers.parseCatalogResources(catalog, false, ['Greek_New_Testament']);
    expect(results.length).toEqual(1);
    expect(results[0].languageId).toEqual('el-x-koine');
  });

  it('should return everything with no filter', () => {
    const results = parseHelpers.parseCatalogResources(catalog, false, null);
    expect(results.length).toEqual(137);
  });

  it('should return everything with default filter', () => {
    const results = parseHelpers.parseCatalogResources(catalog, true);
    expect(results.length).toEqual(93);
  });

  it('should throw exception for null catalog', done => {
    try {
      const results = parseHelpers.parseCatalogResources(null);
      done.fail(results);
    } catch (e) {
      expect(e.message).toEqual(ERROR.CATALOG_CONTENT_ERROR);
      done();
    }
  });
});

describe.skip('getLatestResources()', () => {
  it('should succeed with empty resourceList', () => {
    const resourceList = [];
    const results = parseHelpers.getLatestResources(catalog, resourceList);
    expect(results.length).toEqual(56);

    const greekResources = getResourcesForLanguageAndResource(results, 'el-x-koine');
    expect(greekResources.length).toEqual(1);

    const frenchResources = getResourcesForLanguageAndResource(results, 'fr');
    expect(frenchResources.length).toEqual(3);
  });

  it('should remove french/f10 since already up to date', () => {
    const resourceList = [
      {languageId: 'fr', resourceId: 'f10', modifiedTime: '2018-04-27T18:51:27+00:00'}
    ];
    const results = parseHelpers.getLatestResources(catalog, resourceList);
    expect(results.length).toEqual(55);

    const greekResources = getResourcesForLanguageAndResource(results, 'el-x-koine');
    expect(greekResources.length).toEqual(1);

    const frenchResources = getResourcesForLanguageAndResource(results, 'fr', 'f10');
    expect(frenchResources.length).toEqual(0);
  });

  it('should not remove french/f10 since newer in catalog', () => {
    const resourceList = [
      {languageId: 'fr', resourceId: 'f10', modifiedTime: '2018-04-27T18:51:26+00:00'}
    ];
    const results = parseHelpers.getLatestResources(catalog, resourceList);
    expect(results.length).toEqual(56);

    const greekResources = getResourcesForLanguageAndResource(results, 'el-x-koine');
    expect(greekResources.length).toEqual(1);

    const frenchResources = getResourcesForLanguageAndResource(results, 'fr', 'f10');
    expect(frenchResources.length).toEqual(1);
  });

  it('should throw exception for null resource list', done => {
    try {
      const results = parseHelpers.getLatestResources(catalog, null);
      done.fail(results);
    } catch (e) {
      expect(e.message).toEqual(ERROR.PARAMETER_ERROR);
      done();
    }
  });

  it('should throw exception for null catalog', done => {
    try {
      const results = parseHelpers.getLatestResources(null, []);
      done.fail(results);
    } catch (e) {
      expect(e.message).toEqual(ERROR.PARAMETER_ERROR);
      done();
    }
  });

  it('should throw exception for invalid catalog object', done => {
    try {
      const results = parseHelpers.getLatestResources({ }, []);
      done.fail(results);
    } catch (e) {
      expect(e.message).toEqual(ERROR.CATALOG_CONTENT_ERROR);
      done();
    }
  });
});

describe.skip('getUpdatedLanguageList()', () => {
  const resources = parseHelpers.getLatestResources(catalog, []);

  it('should succeed', () => {
    const languages = parseHelpers.getUpdatedLanguageList(resources);
    expect(languages.length).toEqual(31); // ur-deva = ur-Deva
  });

  it('should return null on null resources', () => {
    const languages = parseHelpers.getUpdatedLanguageList(null);
    expect(languages).toBeNull();
  });
});

describe.skip('getResourcesForLanguage()', () => {
  const resources = parseHelpers.getLatestResources(catalog, []);

  it('should find el-x-koine', () => {
    const results = parseHelpers.getResourcesForLanguage(resources, 'el-x-koine');
    expect(results.length).toEqual(1);
  });

  it('should find hi', () => {
    const results = parseHelpers.getResourcesForLanguage(resources, 'hi');
    expect(results.length).toEqual(4);
    validateResourceType(results, 'irv', 1);
    validateResourceType(results, 'tw', 1);
    validateResourceType(results, 'ulb', 1);
    validateResourceType(results, 'udb', 1);
  });

  it('should find en', () => {
    const results = parseHelpers.getResourcesForLanguage(resources, 'en');
    expect(results.length).toEqual(6);
    validateResourceType(results, 'ta', 1);
    validateResourceType(results, 'tw', 1);
    validateResourceType(results, 'ulb', 1);
    validateResourceType(results, 'udb', 1);
  });

  it('should return empty list for language not found', () => {
    const results = parseHelpers.getResourcesForLanguage(resources, 'zzz');
    expect(results.length).toEqual(0);
  });

  it('should return null if no resources', () => {
    const results = parseHelpers.getResourcesForLanguage(null, 'el-x-koine');
    expect(results).toBeNull();
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
    (!languageId || (resource.languageId === languageId)) &&
    (!resourceId || (resource.resourceId === resourceId))
  );
}

/**
 * verify that number of resources types in results equals expected coung
 * @param {Array} results list
 * @param {String} resourceType - resource type to filter on
 * @param {number} expectCount - number of entries expected
 */
function validateResourceType(results, resourceType, expectCount) {
  const resources = getResourcesForLanguageAndResource(results, null, resourceType);
  expect(resources.length).toEqual(expectCount);
}
