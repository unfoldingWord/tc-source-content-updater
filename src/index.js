import * as apiHelpers from './helpers/apiHelpers';
import * as parseHelpers from './helpers/parseHelpers';
import * as moveResourcesHelpers from './helpers/moveResourcesHelpers';

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
 * Used to initiate a load of the latests resource so that the user can then select which ones
 * they would like to update.
 * Note: This function only returns the resources that already up to date on the user machine
 * @param {boolean} update - indicates whether the latest catalog should be updated
 * before the request
 * @param {Array} resourceList - list of resources that are on the users local machine already
 * @return {Array} - Array of resources and their corresponding time stamps
 */
Updater.prototype.getLatestsResourceDates = async function(update = false,
  resourceList) {
  if (update || !this.catalog) {
    // Can force update before request or will automatically if
    // the resources are not already populated
    await this.updateCatalog();
  }
  return parseHelpers.getLatestsResourceDates(this.catalog, resourceList);
};

/**
 * Downloads the resorces from the specified list using the DCS API
 *
 * @param {Array} resourceList - Array of resources to retrieve from the API
 */
Updater.prototype.downloadResources = async function(resourceList) {
};

/**
 * @param {String} resourceSourcePath - Location of selected downloaded resources
 * @param {String} languageCode - Location of resources destination
 *
 * @return {Array} - Array of objects of the downloaded resources
 */
Updater.prototype.moveResources = async function(
  resourceSourcePath, languageCode) {
  const result = await moveResourcesHelpers.moveResources(
      resourceSourcePath, languageCode);
  return result;
};

export default Updater;
