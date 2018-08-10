/* eslint-disable camelcase,no-empty,no-negated-condition */

/**
 * Gets the list of all new resources in catalog, except for
 * the ones already up to date in the given list
 *
 * @param {{languages: Array.<Object>}} catalog - to parse
 * @param {Array.<{
 *                  lang_code: String,
 *                  bible_id: String,
 *                  modified_time: String
 *                  }>} resourceList - list of resources that are on the users local machine already {}
 * @return {{
 *          languages: Array.<String>,
 *          resources: Array.<{
 *                   lang_code: String,
 *                   bible_id: String,
 *                   local_modified_time: String,
 *                   remote_modified_time: String,
 *                   download_url: String,
 *                   version: String,
 *                   subject: String,
 *                   catalog_entry: {lang_resource, book_resource, format}
 *                 }>
 *         }} updated resources
 */
export function getLatestResources(catalog, resourceList) {
  const bibleSubjects = ['Bible', 'Greek New Testament'];
  const includeSubjects = ['Translation Notes', 'Translation Words', 'Translation Academy'].concat(bibleSubjects);
  const tCoreResources = getTcoreResources(catalog, includeSubjects);
  // filter out resources that are up to date
  for (let localResource of resourceList) {
    if (localResource.lang_code && localResource.bible_id) {
      const index = tCoreResources.findIndex(remoteResource =>
        ((localResource.lang_code === remoteResource.lang_code) &&
          (remoteResource.bible_id === localResource.bible_id)));
      if (index >= 0) {
        const catalogResource = tCoreResources[index];
        const isNewer = !localResource.modified_time ||
          (catalogResource.remote_modified_time > localResource.modified_time);
        if (!isNewer) { // if resource up to date, remove it from resource list
          tCoreResources.splice(index, 1);
        } else {
          catalogResource.local_modified_time = localResource.modified_time;
        }
      }
    }
  }
  const updatedLanguages = [];
  for (let resource of tCoreResources) {
    const langCode = resource.lang_code;
    if (bibleSubjects.includes(resource.subject)) { // everything keyed off of bible resources
      const updatedBible = {
        lang_code: langCode,
        local_modified_time: resource.local_modified_time || '',
        remote_modified_time: resource.remote_modified_time
      };
      const dup = updatedLanguages.findIndex(item =>
        (item.lang_code === langCode)
      );
      if (dup < 0) {
        updatedLanguages.push(updatedBible); // add if language not present
      }
    }
  }
  const languages = updatedLanguages.sort((a, b) =>
                        ((a.lang_code > b.lang_code) ? 1 : -1));
  return {languages, resources: tCoreResources};
}

/**
 * filters the catalog and returns valid tCore resources
 *
 * @param {{languages: Array.<Object>}} catalog - to parse
 * @param {Array.<String>} subjects - arrays of subjects to include
 * @return {Array.<{
 *                   lang_code: String,
 *                   bible_id: String,
 *                   local_modified_time: String,
 *                   remote_modified_time: String,
 *                   download_url: String,
 *                   version: String,
 *                   subject: String,
 *                   catalog_entry: {lang_resource, book_resource, format}
 *                 }>} list of updated resources
 */
export function getTcoreResources(catalog, subjects) {
  const catalogResources = [];
  if (catalog && catalog.languages) {
    for (let language of catalog.languages) {
      const isGreekOL = (language.identifier === "el-x-koine");
      const lang_code = isGreekOL ? 'grc' : language.identifier; // we use grc internally for Greek Original language
      const resources = language.resources || [];
      for (let resource of resources) {
        const isCheckingLevel2 = resource.checking.checking_level >= 2;
        const bible_id = resource.identifier;
        const version = resource.version;
        const subject = resource.subject;
        const formats = resource.formats || [];
        for (let format of formats) {
          try {
            const isZipFormat = format.format.indexOf("application/zip;") >= 0;
            const download_url = format.url;
            const remote_modified_time = format.modified;
            const isBibleOrBibleHelps = subjects.includes(subject);
            if (isBibleOrBibleHelps && isZipFormat && isCheckingLevel2 &&
                download_url && remote_modified_time && lang_code && version) {
              const foundResource = {
                lang_code,
                bible_id,
                remote_modified_time,
                download_url,
                version,
                subject,
                catalog_entry: {
                  lang_resource: language,
                  book_resource: resource,
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
