import AdmZip from 'adm-zip';
import path from 'path-extra';
import fs from 'fs-extra';

/**
 * @description makes sure the resource is unzipped
 * @param {String} resourcePath Path to resource
 */
export const makeSureResourceUnzipped = (resourcePath) => {
  const contentTypes = ['books', 'contents'];
  for (const content of contentTypes) {
    const compressedFile = path.join(resourcePath, content + '.zip');
    if (fs.existsSync(compressedFile)) {
      const zip = new AdmZip(compressedFile);
      zip.extractAllTo(resourcePath, true);
      fs.removeSync(compressedFile);
    }
  }
};
