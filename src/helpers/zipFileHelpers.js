import AdmZip from 'adm-zip';

/**
 * @description unzips a zip file into the destination path.
 * @param {String} zipFilePath Path to zip file
 * @param {String} dest Destination path
 * @param {Boolean} overwrite If true, will overwrite existing files
 */
export const extractZipFile = (zipFilePath, dest, overwrite = true) => {
  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(dest, overwrite);
};
