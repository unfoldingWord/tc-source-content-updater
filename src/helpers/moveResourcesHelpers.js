import fs from 'fs-extra';

/**
 * @description transfer an entire resource from source to target directory
 * @param {string} resourceSourcePath - current position of resource
 * @param {string} resourceTargetPath - folder where resources are moved
 * @return {boolean} true on success
 */
export function moveResources(resourceSourcePath, resourceTargetPath) {
  if (resourceSourcePath && resourceSourcePath.length &&
      resourceTargetPath && resourceTargetPath.length) {
    try {
      fs.ensureDirSync(resourceTargetPath);
      fs.copySync(resourceSourcePath, resourceTargetPath);
      fs.remove(resourceSourcePath);
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  } else {
    console.log('missing argument: |' + resourceSourcePath + "|, |" +
        resourceTargetPath + "|");
    return false;
  }
}

