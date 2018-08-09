import fs from 'fs-extra';

/**
 * @description transfer an entire resource from source to target directory
 * @param {string} resourceSourcePath - current position of resource
 * @param {string} resourceTargetPath - folder where resources are moved
 */
export function moveResources(resourceSourcePath, resourceTargetPath) {
  fs.ensureDirSync(resourceTargetPath);
  fs.copySync(resourceSourcePath, resourceTargetPath);
  fs.remove(resourceSourcePath);
}

