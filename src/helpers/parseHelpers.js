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
  try {
    return resources.filter(resource => (resource.languageId === languageId));
  } catch (error) {
    throw new Error(error);
  }
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
  try {
    const updatedLanguages = [];
    for (let resource of updatedRemoteResources) {
      const languageId = resource.languageId;
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
  } catch (error) {
    throw new Error(error);
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
 * @return {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {subject, resource, format}
 *                 }>|null} updated resources (returns null on error)
 */
export function getLatestResources(catalog, localResourceList) {
  try {
    const tCoreResources = parseCatalogResources(catalog);
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
  } catch (error) {
    throw new Error(error);
  }
  return tCoreResources; // resources that are already up to date have been removed
}

/**
 * parses the remoteCatalog and returns list of catalog resources
 *
 * @param {{subjects: Array.<Object>}} catalog - to parse
 * @param {Array.<String>} subjectFilters - optional array of subjects to include
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
export function parseCatalogResources(catalog, subjectFilters = null) {
  try {
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
  } catch (error) {
    throw new Error(error);
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
