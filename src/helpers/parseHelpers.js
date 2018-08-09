/* eslint-disable camelcase,no-empty */
/**
 * Gets the list of all new resources in catalog, except for
 * the ones already up to date in the given list
 *
 * @param {Object} catalog - to parse
 * @param {Array} resourceList - list of resources that are on the users local machine already {lang_code, bible_id, modified_time}
 * @return {Array} list of updated resources {lang_code, bible_id, local_modified_time, remote_modified_time, download_url, version, catalog_entry: {lang_resource, book_resource, format} }
 */
export function getLatestResources(catalog, resourceList) {
  const catalogResources = getTcoreResources(catalog);
  // filter out resources that are up to date
  for (let localResource of resourceList) {
    if (localResource.lang_code && localResource.bible_id) {
      const index = catalogResources.findIndex(remoteResource =>
        ((localResource.lang_code === remoteResource.lang_code) &&
          (remoteResource.bible_id === localResource.bible_id)));
      if (index >= 0) {
        const catalogResource = catalogResources[index];
        const isNewer = !localResource.modified_time ||
          (catalogResource.remote_modified_time > localResource.modified_time);
        if (!isNewer) { // if resource up to date, remove it from resource list
          catalogResources.splice(index, 1);
        }
      }
    }
  }
  return catalogResources;
}

/**
 * filters the catalog and returns valid tCore resources
 *
 * @param {Object} catalog - to parse
 * @return {Object} set of tCore resources {lang_code, bible_id, remote_modified_time, download_url, version, catalog_entry: {lang_resource, book_resource, format} }
 */
export function getTcoreResources(catalog) {
  const catalogResources = { };
  if (catalog && catalog.languages) {
    for (let language of catalog.languages) {
      const languageResources = {};
      const isGreekOL = (language.identifier === "el-x-koine");
      const lang_code = isGreekOL ? 'grc' : language.identifier; // we use grc internally for Greek Original language
      const resources = language.resources || [];
      for (let resource of resources) {
        const isCheckingLevel2 = resource.checking.checking_level >= 2;
        const bible_id = resource.identifier;
        const version = resource.version;
        const formats = resource.formats || [];
        for (let format of formats) {
          try {
            const isZipFormat = format.format.indexOf("application/zip;") >= 0;
            const isUSFM3Content = format.format.indexOf("text/usfm3") >= 0;
            const download_url = format.url;
            const remote_modified_time = format.modified;
            if (isZipFormat && isUSFM3Content && isCheckingLevel2 &&
                  download_url && remote_modified_time && lang_code &&
                  version) {
              const foundResource = {
                lang_code,
                bible_id,
                remote_modified_time,
                download_url,
                version,
                catalog_entry: {
                  lang_resource: language,
                  book_resource: resource,
                  format
                }
              };
              languageResources[bible_id] = foundResource;
            }
          } catch (e) {
            // recover if required fields are missing
          }
        }
      }
      if (Object.keys(languageResources).length) { // if we found any resources
        catalogResources[lang_code] = languageResources;
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
