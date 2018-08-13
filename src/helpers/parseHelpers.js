/* eslint-disable camelcase,no-empty,no-negated-condition */

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
 *                 }>} updatedRemoteResources - resources that have been update in remote catalog
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
 *                  langId: String,
 *                  bibleId: String,
 *                  modifiedTime: String
 *                  }>} resourceList - list of resources that are on the users local machine already {}
 * @return {Array.<{
 *                   languageId: String,
 *                   resourceId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {langResource, bookResource, format}
 *                 }>} updated resources
 */
export function getLatestResources(catalog, resourceList) {
  const bibleSubjects = ['Bible', 'Greek New Testament'];
  const includeSubjects = ['Translation Notes', 'Translation Words', 'Translation Academy'].concat(bibleSubjects);
  const tCoreResources = getTcoreResources(catalog, includeSubjects);
  // remove resources that are already up to date
  for (let localResource of resourceList) {
    if (localResource.langId && localResource.bibleId) {
      const index = tCoreResources.findIndex(remoteResource =>
        ((localResource.langId === remoteResource.langId) &&
          (remoteResource.bibleId === localResource.bibleId)));
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
 * @param {Array.<String>} subjects - arrays of subjects to include
 * @return {Array.<{
 *                   langId: String,
 *                   bibleId: String,
 *                   localModifiedTime: String,
 *                   remoteModifiedTime: String,
 *                   downloadUrl: String,
 *                   version: String,
 *                   subject: String,
 *                   catalogEntry: {langResource, bookResource, format}
 *                 }>} list of updated resources
 */
export function getTcoreResources(catalog, subjects) {
  const catalogResources = [];
  if (catalog && catalog.languages) {
    for (let language of catalog.subjects) {
      const isGreekOL = (language.identifier === "el-x-koine");
      const langId = isGreekOL ? 'grc' : language.identifier; // we use grc internally for Greek Original language
      const resources = language.resources || [];
      for (let resource of resources) {
        const isCheckingLevel2 = resource.checking.checking_level >= 2;
        const bibleId = resource.identifier;
        const version = resource.version;
        const subject = resource.subject;
        const formats = resource.formats || [];
        for (let format of formats) {
          try {
            const isZipFormat = format.format.indexOf("application/zip;") >= 0;
            const downloadUrl = format.url;
            const remoteModifiedTime = format.modified;
            const isBibleOrBibleHelps = subjects.includes(subject);
            if (isBibleOrBibleHelps && isZipFormat && isCheckingLevel2 &&
                downloadUrl && remoteModifiedTime && langId && version) {
              const foundResource = {
                langId,
                bibleId,
                remoteModifiedTime,
                downloadUrl,
                version,
                subject,
                catalogEntry: {
                  langResource: language,
                  bookResource: resource,
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
