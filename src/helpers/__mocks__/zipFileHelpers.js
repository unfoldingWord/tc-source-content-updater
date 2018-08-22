import AdmZip from 'adm-zip';
import tmp from 'tmp';
import fs from 'fs-extra';
import rimraf from 'rimraf';

/**
 * @description unzips a zip file into the destination path in the mockFS
 * @param {String} zipFilePath Path to zip file
 * @param {String} dest Destination path
 */
export const extractZipFile = (zipFilePath, dest) => {
  const zip = new AdmZip(Buffer.from(fs.readFileSync(zipFilePath), 'utf8'));
  const tmpDirObj = tmp.dirSync();
  zip.extractAllTo(tmpDirObj.name); // Extracts mockFS zip file to a physical directory
  fs.ensureDirSync(dest);
  fs.__loadDirIntoMockFs(tmpDirObj.name, dest); // Loads physical directory of zip content into mockFS
  rimraf.sync(tmpDirObj.name);
};
