import fs from 'fs-extra';
import path from 'path-extra';
// heleprs
import * as resourcesHelpers from '../resourcesHelpers';

/**
 * @description Processes the extracted files for translationAcademy to create a single file for each
 * article
 * @param {String} extractedFilesPath - Path to the extracted files that came from the zip file in the catalog
 * @param {String} outputPath - Path to place the processed files WITHOUT version in the path
 * @return {Boolean} true if success
 */
export function processTranslationAcademy(extractedFilesPath, outputPath) {
  if (!fs.pathExistsSync(extractedFilesPath))
    throw Error(extractedFilesPath + ' does not exist');
  const resourceManifest = resourcesHelpers.getResourceManifest(extractedFilesPath);
  if (fs.pathExistsSync(outputPath)) {
    fs.removeSync(outputPath);
  }
  resourceManifest.projects.forEach(project => {
    const folderPath = path.join(extractedFilesPath, project.path);
    const isDirectory = item => fs.lstatSync(path.join(folderPath, item)).isDirectory();
    const articleDirs = fs.readdirSync(folderPath).filter(isDirectory);
    articleDirs.forEach(articleDir => {
      let content = '# ' + fs.readFileSync(path.join(folderPath, articleDir, 'title.md'), 'utf8') + ' #\n';
      content += fs.readFileSync(path.join(folderPath, articleDir, '01.md'), 'utf8');
      const destinationPath = path.join(
        outputPath,
        project.path,
        articleDir + '.md'
      );
      fs.outputFileSync(destinationPath, content);
    });
  });
  return true;
}
