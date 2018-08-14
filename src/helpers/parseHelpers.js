/* eslint-disable camelcase,no-empty,no-negated-condition */

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
 *                 }>} updatedRemoteResources - resources that have been updated in remote catalog
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
 *                 }>} - all updated resources for language
 */
export function getResourcesForLanguage(updatedRemoteResources, languageId) {
  return updatedRemoteResources.filter(resource =>
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
 *         }} - list of languages that have updates in catalog
 */
export function getUpdatedLanguageList(updatedRemoteResources) {
  const updatedLanguages = [];
  for (let resource of updatedRemoteResources) {
    const languageId = resource.langId;
    const updatedBible = {
      languageId,
      localModifiedTime: resource.localModifiedTime || '',
      remoteModifiedTime: resource.remoteModifiedTime
    };
    const dup = updatedLanguages.findIndex(item =>
      (item.languageId === languageId)
    );
    if (dup < 0) {
      updatedLanguages.push(updatedBible); // add if language not present
    }
  }
  const languages = updatedLanguages.sort((a, b) =>
    ((a.languageId > b.languageId) ? 1 : -1));
  return languages;
}

/**
 * Gets the list of all new resources in remoteCatalog, except for
 * the ones already up to date in the given list
 *
 * @param {{languages: Array.<Object>}} catalog - to parse
 * @param {Array.<{
 *                  languageId: String,
 *                  resourceId: String,
 *                  modifiedTime: String,
 *                  }>} localResourceList - list of resources that are on the users local machine already {}
 * @return {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {subject, resource, format}
 *                 }>} updated resources
 */
export function getLatestResources(catalog, localResourceList) {
  const tCoreResources = getTcoreResources(catalog);
  // remove resources that are already up to date
  for (let localResource of localResourceList) {
    if (localResource.languageId && localResource.resourceId) {
      const index = tCoreResources.findIndex(remoteResource =>
        ((localResource.languageId === remoteResource.languageId) &&
          (remoteResource.resourceId === localResource.resourceId)));
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
  return tCoreResources; // resources that are already up to date have been removed
}

/**
 * filters the remoteCatalog and returns valid tCore resources
 *
 * @param {{languages: Array.<Object>}} catalog - to parse
 * @param {Array.<String>} subjectFilters - optional array of subjects to include
 * @return {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {subject, resource, format}
 *                 }>} list of updated resources
 */
export function getTcoreResources(catalog, subjectFilters = null) {
  const catalogResources = [];
  if (catalog && catalog.subjects) {
    for (let catSubject of catalog.subjects) {
      const subject = catSubject.identifier;
      const isGreekOL = (catSubject.language === "el-x-koine");
      const languageId = isGreekOL ? 'grc' : catSubject.language; // we use grc internally for Greek Original language
      const resource = catSubject.resources || [];
      const isCheckingLevel2 = resource.checking.checking_level >= 2;
      const resourceId = resource.identifier;
      const version = resource.version;
      const formats = resource.formats || [];
      for (let format of formats) {
        try {
          const isZipFormat = format.format.indexOf("application/zip;") >= 0;
          const downloadUrl = format.url;
          const remoteModifiedTime = format.modified;
          const isDesiredSubject = !subjectFilters ||
            subjectFilters.includes(subject);
          if (isDesiredSubject && isZipFormat && isCheckingLevel2 &&
              downloadUrl && remoteModifiedTime && languageId && version) {
            const foundResource = {
              languageId,
              resourceId,
              remoteModifiedTime,
              downloadUrl,
              version,
              subject,
              catalogEntry: {
                subject,
                resource,
                format
              }
            };
            catalogResources.push(foundResource);
          }
        } catch (e) {
          // recover if required fields are missing
        }
      }
    }
  }
  return catalogResources;
}

/**
 * Formats the given content in an importable form for tC
 * @param {Object} content - The unparsed content from DCS
 */
export function formatResources(content) {
  //
}
