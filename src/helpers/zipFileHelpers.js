import AdmZip from 'adm-zip';

/**
 * @description unzips a zip file into the destination path.
 * @param ZipPath Zip file
 * @param dest Destination path
 */
export const extractZipFile = (zipFilePath, dest, overwrite = true) => {
  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(dest, overwrite);
};
