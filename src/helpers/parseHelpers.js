/* eslint-disable camelcase,no-empty,no-negated-condition */
import semver from 'semver';
import * as ERROR from '../resources/errors';
import {sortDownloableResources} from './resourcesDownloadHelpers';

// the following are the subject found in the door43 catalog.
// if a subject isn't found in this list then it will be ignored by the source content updater
export const TC_RESOURCES = [
  'Bible',
  'Aligned_Bible',
  'Greek_New_Testament',
  'Hebrew_Old_Testament',
  'TSV_Translation_Notes',
  'Bible_translation_comprehension_questions',
  'Translation_Words',
  'TSV_Translation_Words_Links',
  'Translation_Academy',
];

export const RESOURCE_ID_MAP = {
  translationWords: 'tw',
  translationWordsLinks: 'twl',
  translationNotes: 'tn',
  translationAcademy: 'ta',
};

/**
 * get all resources to update for language
 * @param {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {langResource, bookResource, format}
 *                 }>} resources - resources to filter
 * @param {String} languageId - language to search for
 * @return {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {langResource, bookResource, format}
 *                 }>|null} - filtered resources for language (returns null on error)
 */
export function getResourcesForLanguage(resources, languageId) {
  if (!Array.isArray(resources)) {
    return null;
  }
  return resources.filter((resource) =>
    (resource.languageId === languageId));
}

/**
 * extract list of languages that need to be updated from resources
 *  that need to be updated
 *
 * @param {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {langResource, bookResource, format}
 *                 }>} updatedRemoteResources - resources that have been updated in remote catalog
 * @return {
 *          Array.<{
 *                   languageId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String
 *                 }>
 *         }|null} - list of languages that have updates in catalog (returns null on error)
 */
export function getUpdatedLanguageList(updatedRemoteResources) {
  if (!Array.isArray(updatedRemoteResources)) {
    return null;
  }
  const updatedLanguages = [];
  for (const resource of updatedRemoteResources) {
    const languageId = resource.languageId;
     const dup = updatedLanguages.findIndex((item) =>
      (item.languageId === languageId)
    );
    const resLocalModifiedTime = resource.localModifiedTime || '';
    if (dup < 0) {
      const updatedLanguage = {
        languageId,
        localModifiedTime: resLocalModifiedTime,
        remoteModifiedTime: resource.remoteModifiedTime,
        resources: [resource],
      };
      updatedLanguages.push(updatedLanguage); // add if language not present
    } else {
      const languageItem = updatedLanguages[dup];
      languageItem.localModifiedTime = (languageItem.localModifiedTime > resLocalModifiedTime) ? languageItem.localModifiedTime : resLocalModifiedTime;
      languageItem.remoteModifiedTime = (languageItem.remoteModifiedTime > resource.remoteModifiedTime) ? languageItem.remoteModifiedTime : resource.remoteModifiedTime;
      languageItem.resources.push(resource);
    }
  }
  return updatedLanguages.sort((a, b) =>
    ((a.languageId > b.languageId) ? 1 : -1));
}

/**
 * search remote resources for match similar to local resource, but with given resourceId.  Return true if remote resource is newer
 * @param {String} resourceId
 * @param {Array} remoteResources
 * @param {Object} localResource
 * @return {{resourceId, catalogResource, isNewer: boolean, index: *}}
 */
function isRemoteNewerResLookup(resourceId, remoteResources, localResource) {
  resourceId = RESOURCE_ID_MAP[resourceId] || resourceId; // map resource names to ids
  const index = remoteResources.findIndex((remoteResource) =>
    ((localResource.languageId.toLowerCase() === remoteResource.languageId.toLowerCase()) &&
      (localResource.owner === remoteResource.owner) &&
      (remoteResource.resourceId === resourceId))
  );

  let isNewer = false;
  let catalogResource;
  if (index >= 0) {
    catalogResource = remoteResources[index];
    const localModifiedTime = localResource.modifiedTime || (localResource.manifest && localResource.manifest.modified);
    isNewer = !localModifiedTime ||
      (catalogResource.remoteModifiedTime > localModifiedTime);
    catalogResource.localModifiedTime = localModifiedTime;
  } else {
    isNewer = true; // newer if not stored locally
  }
  return {
    resourceId,
    index,
    isNewer,
    catalogResource,
  };
}

/**
 * compares version numbers, if a > b returns 1; if a < b return -1; else are equal and return 0
 * @param {string} a
 * @param {string} b
 * @return {number}
 */
export function compareVersions(a, b) {
  const cleanA = semver.coerce(a);
  const cleanB = semver.coerce(b);

  if (semver.gt(cleanA, cleanB)) {
    return 1;
  } else if (semver.lt(cleanA, cleanB)) {
    return -1;
  } else {
    return 0;
  }
}

/**
 * determine if manifest key for local resource is outdated
 * @param {object} localResource
 * @param {object} latestManifestKey
 * @param {boolean} isRemoteNewer
 * @return {boolean} - returns true if manifest key is missing or outdated
 */
function isLocalResourceManifestKeyOutdated(localResource, latestManifestKey, isRemoteNewer) {
  const manifest = localResource && localResource.manifest;
  if (latestManifestKey && manifest) {
    const subject = manifest.subject || (manifest.dublin_core && manifest.dublin_core.subject);
    const manifestKeys = latestManifestKey[subject];

    if (manifestKeys) {
      const keys = Object.keys(manifestKeys);
      const manifestKey = keys.length ? keys[0] : null;

      if (manifestKey) {
        const localResourceKey = manifest[manifestKey];
        const minimumManifestKey = manifestKeys[manifestKey];

        if (!localResourceKey || (compareVersions(localResourceKey, minimumManifestKey) < 0)) { // if local manifest key is less than minimum
          isRemoteNewer = true;
        }
      }
    }
  }
  return isRemoteNewer;
}

/**
 * Gets the list of all new resources in remoteCatalog, except for
 * the ones already up to date in the given list
 *
 * @param {{subjects: Array.<Object>}} catalog - to parse
 * @param {Array.<{
 *                  languageId: String,
 *                  resourceId: String,
 *                  modifiedTime: String,
 *                  }>} localResourceList - list of resources that are on the users local machine already {}
 * @param {object} config
 * @param {array|null} config.filterByOwner - if given, a list of owners to allow for download, updatedCatalogResources and returned list will be limited to these owners
 * @param {object|null} config.latestManifestKey - for resource type make sure manifest key is at specific version, by subject
 * @param {string|null} config.stage - stage for search, default is production
 * @return {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {subject, resource, format}
 *                 }>} updated resources  (throws exception on error)
 */
export function getLatestResources(catalog, localResourceList, config) {
  if (!catalog || !Array.isArray(localResourceList)) {
    throw new Error(ERROR.PARAMETER_ERROR);
  }

  const latestManifestKey = config.latestManifestKey || {};
  const filterByOwner = config.filterByOwner;
  const bibleKey = latestManifestKey && latestManifestKey['Bible'];

  if (bibleKey) { // if Bible type, copy to all bible types
    const otherBibleTypes = ['Aligned Bible', 'Greek New Testament', 'Hebrew Old Testament'];

    for (const type of otherBibleTypes) {
      latestManifestKey[type] = bibleKey;
    }
  }

  const config_ = {
    ...config,
    ignoreObsResources: true,
    subjectFilters: TC_RESOURCES,
  };
  let tCoreResources = parseCatalogResources(catalog, config_);
  // remove resources that are already up to date

  for (const localResource of localResourceList) {
    const resourceId = localResource.resourceId;

    if (localResource.languageId && resourceId) {
      const {
        index,
        isNewer,
      } = isRemoteNewerResLookup(resourceId, tCoreResources, localResource);

      let isRemoteNewer_ = isNewer;

      if (!isRemoteNewer_ && Object.keys(latestManifestKey).length) {
        isRemoteNewer_ = isLocalResourceManifestKeyOutdated(localResource, latestManifestKey, isRemoteNewer_);
      }

      if (!isRemoteNewer_ && (index >= 0)) {
        const resource = tCoreResources[index];
        if (resource.loadAfter) {
          const resourceAfter = resource.loadAfter;
          const localResource = localResourceList.find(() =>
            ((localResource.languageId.toLowerCase() === resourceAfter.languageId.toLowerCase()) &&
              (localResource.owner === resourceAfter.owner) &&
              (localResource.resourceId === resourceAfter.resourceId))
          );
          if (localResource) {
            const isRemoteNewe = !localResource.modifiedTime ||
              (resourceAfter.remoteModifiedTime > resourceAfter.modifiedTime);
            isRemoteNewer_ = isRemoteNewe;
          }
        }
      }
      if (!isRemoteNewer_) { // if resource up to date, remove it from resource list
        tCoreResources.splice(index, 1);
      }
    }
  }

  if (filterByOwner) { // we need to remove resources that are not in owner list
    const filteredResources = tCoreResources.filter(resource => (filterByOwner.includes(resource.owner)));
    const itemsRemoved = tCoreResources.length - filteredResources.length;
    console.log(`${itemsRemoved} items removed from filtered list, new length is ${filteredResources.length}`);
    tCoreResources = filteredResources;
  }

  return sortDownloableResources(tCoreResources);
}

/**
 * if Array is not valid, return empty array
 * @param {Array} array - array to validate
 * @return {Array} array if valid, or empty array
 */
export function getValidArray(array) {
  if (Array.isArray(array)) {
    return array;
  }
  return [];
}

/**
 * gets an array of the formats.  Most are in resources.formats, but tWords are in resources.projects.formats
 * @param {Object} resource object
 * @return {Array} array if valid, or empty array
 */
export function getFormatsForResource(resource) {
  if (Array.isArray(resource.formats)) {
    return resource.formats;
  }

  if (Array.isArray(resource.projects)) {
    const formats = [];
    for (const project of resource.projects) {
      const projectFormats = getFormatsForResource(project);
      formats.push(...projectFormats);
    }
    return formats;
  }

  return [];
}

/**
 * get pertinent info to identify resource
 * @param {object} resource
 * @return {string}
 */
function getResourceInfo(resource) {
  const info = {
    subject: resource.subject,
    checkingLevel: resource.checking_level,
    downloadUrl: resource.downloadUrl,
    remoteModifiedTime: resource.remoteModifiedTime,
    languageId: resource.languageId,
    resourceId: resource.resourceId,
    owner: resource.owner,
    version: resource.version,
  };
  return JSON.stringify(info);
}

/**
 * parses the remoteCatalog and returns list of catalog resources
 *
 * @param {{subjects: Array.<Object>}} catalog - to parse
 * @param {object} config
 * @param {boolean} config.ignoreObsResources - if true then reject obs resources
 * @param {Array.<String>} config.subjectFilters - optional array of subjects to include.  If null then every subject is returned
 * @return {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {subject, resource, format}
 *                 }>|null} list of updated resources (returns null on error)
 */
export function parseCatalogResources(catalog, config= {}) {
  if (!catalog || !Array.isArray(catalog)) {
    throw new Error(ERROR.CATALOG_CONTENT_ERROR);
  }
  const ignoreObsResources = config.ignoreObsResources !== false;
  const catalogResources = [];
  for (let i = 0, len = catalog.length; i < len; i++) {
    const catalogItem = catalog[i];
    if (catalogItem.stage !== 'prod') {
      console.log(`catalog item stage ${catalogItem.stage} found`);
    }
    const subject = catalogItem.subject;
    const languageId = catalogItem.languageId.toLowerCase();
    const isCheckingLevel2 = catalogItem.checking_level >= 2;
    let resourceId = catalogItem.resourceId || '';
    if (resourceId.includes('_')) {
      // try to strip off languageId
      const [, resourceId_] = resourceId.split('_');
      if (resourceId_) {
        resourceId = resourceId_;
      }
    }
    if (ignoreObsResources && (resourceId.indexOf('obs') >= 0)) { // see if we should skip obs resources
      // console.log(`skipping OBS item: ${catalogItem.full_name}`);
      continue;
    }
    const downloadUrl = catalogItem.downloadUrl;
    const remoteModifiedTime = catalogItem.modified;
    const isDesiredSubject = !config.subjectFilters ||
      config.subjectFilters.includes(subject);
    let version = catalogItem.version;
    if (!version) {
      version = 'master'; // we are on latest
    } else if (version[0].toLowerCase() === 'v') { // trim leading v
      version = version.substr(1);
    }
    if (!(catalogItem.projects && catalogItem.projects.length) && !(catalogItem.books && catalogItem.books.length)) {
      console.log(`parseCatalogResources - skipping resource with no content ${getResourceInfo(catalogItem)}`);
      continue;
    }
    if (isDesiredSubject && isCheckingLevel2 &&
      downloadUrl && remoteModifiedTime && languageId) {
      const foundResource = {
        languageId,
        resourceId,
        remoteModifiedTime,
        downloadUrl,
        version,
        subject,
        owner: catalogItem.owner,
        catalogEntry: {
          subject,
          resource: catalogItem,
        },
      };
      catalogResources.push(foundResource);
    } else {
      console.log(`parseCatalogResources - skipping ${getResourceInfo(catalogItem)}`);
    }
  }
  console.log(`parseCatalogResources - filtered catalog length: ${catalogResources.length}`);
  return catalogResources;
}

