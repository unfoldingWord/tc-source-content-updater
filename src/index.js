import * as apiHelpers from './helpers/apiHelpers';
import * as parseHelpers from './helpers/parseHelpers';
import * as moveResourcesHelpers from './helpers/moveResourcesHelpers';

/**
 * Updater constructor
 */
function Updater() {
  this.catalog = {};
}

Updater.prototype = {};

/**
 * Fetch the latest catalog
 */
Updater.prototype.updateCatalog = async function() {
  this.catalog = await apiHelpers.getCatalog();
};

/**
 *
 * @param {boolean} update - indicates whether the latest catalog should be updated
 * before the request
 * @return {Array} - Array of resources and their corresponding time stamps
 */
Updater.prototype.getLatestsResourceDates = async function(update = false) {
  if (update) {
    await this.updateCatalog();
  }
  return parseHelpers.getLatestsResourceDates(this.catalog);
};

/**
 * @param {Array} resourceList - Array of resources to retrieve from the API
 * @return {Array} - Array of objects of the downloaded resources
 */
Updater.prototype.downloadResources = async function(resourceList) {
  const content = await apiHelpers.downloadResources(resourceList);
  return await parseHelpers.formatResources(content);
};

/**
 * @param {String} resourceSourcePath - Location of selected downloaded resources
 * @param {String} resourceTargetPath - Location of resources destination
 *
 * @return {Array} - Array of objects of the downloaded resources
 */
Updater.prototype.moveResources = async function(
  resourceSourcePath, resourceTargetPath) {
  const content = await moveResourcesHelpers.move(resourceSourcePath, resourceTargetPath);
  return;
};

export default Updater;
