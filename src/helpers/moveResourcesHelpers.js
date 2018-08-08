import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';

// constants
const RESOURCES_PATH = path.join(ospath.home(), 'translationCore', 'resources');

/**
 *
 * @param {string} resourceSourcePath - current position of resources
 * @param {string} languageCode - foleder where resources are moved
 */
export function moveResources(resourceSourcePath, languageCode) {
  var resourceTargetPath = path.join(RESOURCES_PATH, languageCode);
  fs.copySync(resourceSourcePath, resourceTargetPath);
  fs.remove(resourceSourcePath);
}

