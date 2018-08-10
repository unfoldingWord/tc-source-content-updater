import * as packageParseHelpers from './packageParseHelpers';

/**
 * Gets the list of all new resources from DCS, expect for
 * the ones already up to date in the given list
 *
 * @param {Object} catalog - The catalog from the API
 * @param {Array} resourceList - list of resources that are on the users local machine already
 */
export function getLatestsResourceDates(catalog, resourceList) {
  //
}

/**
 * Formats the given content in an importable form for tC
 * @param {Object} content - The unparsed content from DCS
 */
export function formatResources(content) {
  //
}

/**
 * Parse the bible package to generate json bible contents, manifest, and index
 * @param {String} packagePath - path to downloaded (unzipped) package
 * @param {String} resultsPath - path to store processed bible
 * @return {Boolean} true if success
 */
export function parseBiblePackage(packagePath, resultsPath) {
  return packageParseHelpers.parseBiblePackage(packagePath, resultsPath);
}
