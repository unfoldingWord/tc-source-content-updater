/* eslint-env jest */
/* eslint-disable camelcase,no-empty */
import _ from 'lodash';
import * as parseHelpers from '../src/helpers/parseHelpers';
import * as ERROR from '../src/resources/errors';
import {combineTwords} from '../src/helpers/apiHelpers';

const catalog = require('./fixtures/catalogNext');
const catalogUW_ = require('./fixtures/catalogNextUW');
const catalogUW = combineTwords(_.cloneDeep(catalogUW_));

describe('parseCatalogResources()', () => {
  it('should find Bibles', () => {
    const config = {
      ignoreObsResources: true,
      subjectFilters: ['Bible'],
    };
    const results = parseHelpers.parseCatalogResources(catalog, config);
    expect(results.length).toEqual(2);
  });

  it('All language Ids are lower case', () => {
    const results = parseHelpers.parseCatalogResources(catalog, {});
    const re = /^[-a-z0-9]*$/; // dash is allowed

    expect(results.length).toBeGreaterThan(0);
    for ( let idx = 0; idx < results.length; idx++) {
      //console.log( "results.languageId: ", results[idx].languageId );
      expect(results[idx].languageId).toEqual(expect.stringMatching(re));
    }
  });

  it('should find Greek OL', () => {
    const config = {
      ignoreObsResources: false,
      subjectFilters: ['Greek_New_Testament'],
    };
    const results = parseHelpers.parseCatalogResources(catalog, config );
    expect(results.length).toEqual(1);
    expect(results[0].languageId).toEqual('el-x-koine');
  });

  it('should return everything with no filter', () => {
    const results = parseHelpers.parseCatalogResources(catalog, {});
    expect(results.length).toEqual(11);
  });

  it('should return everything with default filter', () => {
    const config = {
      ignoreObsResources: true,
    };
    const results = parseHelpers.parseCatalogResources(catalog, config);
    expect(results.length).toEqual(11);
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

describe('getLatestResources()', () => {
  it('should succeed with empty resourceList', () => {
    const resourceList = [];
    const results = parseHelpers.getLatestResources(catalog, resourceList, {});
    expect(results.length).toEqual(11);

    const greekResources = getResourcesForLanguageAndResource(results, 'el-x-koine');
    expect(greekResources.length).toEqual(1);

    const frenchResources = getResourcesForLanguageAndResource(results, 'ceb');
    expect(frenchResources.length).toEqual(3);
  });

  it('should remove french/f10 since already up to date', () => {
    const resourceList = [
      {languageId: 'fr', resourceId: 'f10', modifiedTime: '2018-04-27T18:51:27+00:00'}
    ];
    const results = parseHelpers.getLatestResources(catalog, resourceList, {});
    expect(results.length).toEqual(11);

    const greekResources = getResourcesForLanguageAndResource(results, 'el-x-koine');
    expect(greekResources.length).toEqual(1);

    const frenchResources = getResourcesForLanguageAndResource(results, 'fr', 'f10');
    expect(frenchResources.length).toEqual(0);
  });

  it('should not remove en/ult since Bible does not have manifest key', () => {
    const resourceList = [
      {
        languageId: 'en',
        resourceId: 'ult',
        modifiedTime: '2021-12-06T00:00:00Z',
        owner: 'unfoldingWord',
        manifest: { subject: 'Aligned Bible' },
      },
    ];
    const latestManifestKey = { Bible: { usfmjs: '1.0.0' } };
    const config = {
      latestManifestKey,
    };
    const results = parseHelpers.getLatestResources(catalogUW, resourceList, config);
    expect(results.length).toEqual(12);

    const EnUltResources = getResourcesForLanguageAndResource(results, 'en', 'ult');
    expect(EnUltResources.length).toEqual(1);
  });

  it('should remove en/ult since Bible manifest key is current', () => {
    const resourceList = [
      {
        languageId: 'en',
        resourceId: 'ult',
        modifiedTime: '2021-12-06T00:00:00Z',
        owner: 'unfoldingWord',
        manifest: {
          subject: 'Aligned Bible',
          usfmjs: '1.0.0',
        },
      },
    ];
    const latestManifestKey = { Bible: { usfmjs: '1.0.0' } };
    const config = {
      latestManifestKey,
    };
    const results = parseHelpers.getLatestResources(catalogUW, resourceList, config);
    expect(results.length).toEqual(11);

    const EnUltResources = getResourcesForLanguageAndResource(results, 'en', 'ult');
    expect(EnUltResources.length).toEqual(0);
  });

  it('should not remove en/ult since Bible has older manifest key', () => {
    const resourceList = [
      {
        languageId: 'en',
        resourceId: 'ult',
        modifiedTime: '2021-12-06T00:00:00Z',
        owner: 'unfoldingWord',
        manifest: {
          subject: 'Aligned Bible',
          usfmjs: '9.0.0',
        },
      },
    ];
    const latestManifestKey = { Bible: { usfmjs: '10.0.0' } };
    const config = {
      latestManifestKey,
    };
    const results = parseHelpers.getLatestResources(catalogUW, resourceList, config);
    expect(results.length).toEqual(12);

    const EnUltResources = getResourcesForLanguageAndResource(results, 'en', 'ult');
    expect(EnUltResources.length).toEqual(1);
  });

  it('should not remove french/f10 since newer in catalog', () => {
    const resourceList = [
      {languageId: 'fr', resourceId: 'f10', modifiedTime: '2018-04-27T18:51:26+00:00'}
    ];
    const results = parseHelpers.getLatestResources(catalogUW, resourceList, {});
    expect(results.length).toEqual(12);

    const greekResources = getResourcesForLanguageAndResource(results, 'el-x-koine');
    expect(greekResources.length).toEqual(1);

    const frenchResources = getResourcesForLanguageAndResource(results, 'ceb', 'udb');
    expect(frenchResources.length).toEqual(1);
  });

  it('should throw exception for null resource list', done => {
    try {
      const results = parseHelpers.getLatestResources(catalog, null, {});
      done.fail(results);
    } catch (e) {
      expect(e.message).toEqual(ERROR.PARAMETER_ERROR);
      done();
    }
  });

  it('should throw exception for null catalog', done => {
    try {
      const results = parseHelpers.getLatestResources(null, [], {});
      done.fail(results);
    } catch (e) {
      expect(e.message).toEqual(ERROR.PARAMETER_ERROR);
      done();
    }
  });

  it('should throw exception for invalid catalog object', done => {
    try {
      const results = parseHelpers.getLatestResources({ }, [], {});
      done.fail(results);
    } catch (e) {
      expect(e.message).toEqual(ERROR.CATALOG_CONTENT_ERROR);
      done();
    }
  });
});

describe('getUpdatedLanguageList()', () => {
  const resources = parseHelpers.getLatestResources(catalog, [], {});

  it('should succeed', () => {
    const languages = parseHelpers.getUpdatedLanguageList(resources);
    expect(languages.length).toEqual(5);
  });

  it('should return null on null resources', () => {
    const languages = parseHelpers.getUpdatedLanguageList(null);
    expect(languages).toBeNull();
  });
});

describe('getResourcesForLanguage()', () => {
  const resources = parseHelpers.getLatestResources(catalog, [], {});

  it('should find el-x-koine', () => {
    const results = parseHelpers.getResourcesForLanguage(resources, 'el-x-koine');
    expect(results.length).toEqual(1);
  });

  it('should find hi', () => {
    const results = parseHelpers.getResourcesForLanguage(resources, 'hi');
    expect(results.length).toEqual(2);
    validateResourceType(results, 'irv', 0);
    validateResourceType(results, 'tw', 0);
    validateResourceType(results, 'glt', 1);
    validateResourceType(results, 'gst', 1);
  });

  it('should find en', () => {
    const results = parseHelpers.getResourcesForLanguage(resources, 'en');
    expect(results.length).toEqual(4);
    validateResourceType(results, 'ta', 1);
    validateResourceType(results, 'tw', 1);
    validateResourceType(results, 'ult', 1);
    validateResourceType(results, 'ust', 1);
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
