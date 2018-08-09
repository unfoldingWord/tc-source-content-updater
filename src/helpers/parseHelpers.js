/* eslint-disable camelcase,no-empty */
/**
 * Gets the list of all new resources in catalog, except for
 * the ones already up to date in the given list
 *
 * @param {Object} catalog - to parse
 * @param {Array} resourceList - list of resources that are on the users local machine already {lang_code, modified_time}
 * @return {Array} list of resources and their corresponding time stamps {lang_code, local_modified_time, remote_modified_time}
 */
export function getLatestResources(catalog, resourceList) {
  return [];
}

/**
 * Gets the list of all resources from DCS
 *
 * @param {Object} catalog - to parse
 * @return {Array} list of resources and their corresponding time stamps {lang_code, modified_time}
 */
export function getTcResources(catalog) {
  const catalogResources = [];
  if (catalog && catalog.languages) {
    for (let language of catalog.languages) {
      const resources = language.resources || [];
      for (let resource of resources) {
        const formats = resource.formats || [];
        for (let format of formats) {
          try {
            const isZipFormat = format.format.indexOf("application/zip;") >= 0;
            const isUSFM3Content = format.format.indexOf("text/usfm3") >= 0;
            const isCheckingLevel2 = resource.checking.checking_level >= 2;
            const download_url = format.url;
            const remote_modified_time = format.modified;
            let isGreekOL = (language.identifier === "el-x-koine");
            let lang_code = isGreekOL ? 'grc' : language.identifier; // we use grc internally for
            const version = resource.version;
            if (isZipFormat && isUSFM3Content && isCheckingLevel2 &&
                  download_url && remote_modified_time && lang_code &&
                  version) {
              const foundResource = {
                lang_code,
                remote_modified_time,
                download_url,
                version,
                catalog_entry: {
                  lang_resource: language,
                  book_resource: resource,
                  format
                }
              };
              catalogResources.push(foundResource);
            }
          } catch(e) {
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
 * @param {Object} content - The unparsed conent from DCS
 */
export function formatResources(content) {
  //
}
