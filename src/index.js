import * as apiHelpers from './helpers/apiHelpers';
import * as parseHelpers from './helpers/parseHelpers';

/**
 * Updater constructor
 */
function Updater() {
  this.catalog = null;
}

Updater.prototype = {};

/**
 * Method to manually fetch the latest catalog for the current
 * Updater instance. This function has no return value
 */
Updater.prototype.updateCatalog = async function() {
  this.catalog = await apiHelpers.getCatalog();
};

/**
 * Used to initiate a load of the latest resource so that the user can then select which ones
 * they would like to update.
 * Note: This function only returns the resources that are not up to date on the user machine
 * @param {boolean} update - indicates whether the latest catalog should be updated
 * before the request
 * @param {Array} resourceList - list of resources that are on the users local machine already {lang_code, bible_id, modified_time}
 * @return {Array} list of updated resources {lang_code, bible_id, local_modified_time, remote_modified_time, download_url, version, catalog_entry: {lang_resource, book_resource, format} }
 */
Updater.prototype.getLatestResources = async function(update = false,
                                                      resourceList) {
  if (update || !this.catalog) {
    // Can force update before request or will automatically if
    // the resources are not already populated
    await this.updateCatalog();
  }
  return parseHelpers.getLatestResources(this.catalog, resourceList);
};

/**
 * Downloads the resources from the specified list using the DCS API
 *
 * @param {Array} resourceList - Array of resources to retrieve from the API
 */
Updater.prototype.downloadResources = async function(resourceList) {
};

export default Updater;
