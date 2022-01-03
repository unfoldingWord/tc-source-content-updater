/* eslint-disable camelcase,no-empty,no-negated-condition */
import * as ERROR from '../resources/errors';

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
  'Translation_Academy',
];

export const RESOURCE_ID_MAP = {
  translationWords: 'tw',
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
 * Gets the list of all new resources in remoteCatalog, except for
 * the ones already up to date in the given list
 *
 * @param {{subjects: Array.<Object>}} catalog - to parse
 * @param {Array.<{
 *                  languageId: String,
 *                  resourceId: String,
 *                  modifiedTime: String,
 *                  }>} localResourceList - list of resources that are on the users local machine already {}
 * @param {array} filterByOwner - if given, a list of owners to allow for download, returned list will be limited to these owners
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
export function getLatestResources(catalog, localResourceList, filterByOwner = null) {
  if (!catalog || !Array.isArray(localResourceList)) {
    throw new Error(ERROR.PARAMETER_ERROR);
  }
  let tCoreResources = parseCatalogResources(catalog, true, TC_RESOURCES);
  // remove resources that are already up to date
  for (const localResource of localResourceList) {
    let resourceId = localResource.resourceId;
    if (localResource.languageId && resourceId) {
      resourceId = RESOURCE_ID_MAP[resourceId] || resourceId; // map resource names to ids
      const index = tCoreResources.findIndex((remoteResource) =>
        ((localResource.languageId.toLowerCase() === remoteResource.languageId.toLowerCase()) &&
          (localResource.owner === remoteResource.owner) &&
          (remoteResource.resourceId === resourceId))
      );

      if (index >= 0) {
        const catalogResource = tCoreResources[index];
        const isNewer = !localResource.modifiedTime ||
          (catalogResource.remoteModifiedTime > localResource.modifiedTime);
        if (!isNewer) { // if resource up to date, remove it from resource list
          tCoreResources.splice(index, 1);
        } else {
          catalogResource.localModifiedTime = localResource.modifiedTime;
        }
      }
    }
  }

  if (filterByOwner) { // we need to remove resources that are not in owner list
    const filteredResources = tCoreResources.filter(resource => (filterByOwner.includes(resource.owner)));
    const itemsRemoved = tCoreResources.length - filteredResources.length;
    console.log(`${itemsRemoved} items removed from filtered list, new length is ${filteredResources.length}`);
    tCoreResources = filteredResources;
  }

  return tCoreResources.sort((a, b) =>
    ((a.languageId > b.languageId) ? 1 : -1)); // resources that are already up to date have been removed, sort by language
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
 * parses the remoteCatalog and returns list of catalog resources
 *
 * @param {{subjects: Array.<Object>}} catalog - to parse
 * @param {boolean} ignoreObsResources - if true then reject obs resources
 * @param {Array.<String>} subjectFilters - optional array of subjects to include.  If null then every subject is returned
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
export function parseCatalogResources(catalog, ignoreObsResources = true, subjectFilters = null) {
  if (!catalog || !Array.isArray(catalog)) {
    throw new Error(ERROR.CATALOG_CONTENT_ERROR);
  }
  const catalogResources = [];
  for (let i = 0, len = catalog.length; i < len; i++) {
    const catalogItem = catalog[i];
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
    const isDesiredSubject = !subjectFilters ||
      subjectFilters.includes(subject);
    let version = catalogItem.version;
    if (!version) {
      version = 'master'; // we are on latest
    } else if (version[0].toLowerCase() === 'v') { // trim leading v
      version = version.substr(1);
    }
    if (!(catalogItem.projects && catalogItem.projects.length) && !(catalogItem.books && catalogItem.books.length)) {
      continue; // skip over repos with no projects or books
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
      // console.log(`skipping: ${JSON.stringify(catalogItem)}`);
    }
  }
  console.log(`filtered catalog length: ${catalogResources.length}`);
  return catalogResources;
}

