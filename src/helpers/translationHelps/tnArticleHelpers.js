import fs from 'fs-extra';
// import path from 'path-extra';
import {isObject} from 'util';
// helpers
import * as resourcesHelpers from '../resourcesHelpers';
// constants
import * as errors from '../../resources/errors';

/**
 * @description Processes the extracted files for translationNotes to separate the folder
 * structure and produce the index.js file for the language with the title of each article.
 * @param {Object} resource - Resource object
 * @param {String} sourcePath - Path to the extracted files that came from the zip file from the catalog
 * @param {String} outputPath - Path to place the processed resource files WIHTOUT the version in the path
 */
export function processTranslationNotes(resource, sourcePath, outputPath) {
  if (!resource || !isObject(resource) || !resource.languageId || !resource.resourceId) {
    throw Error(resourcesHelpers.formatError(resource, errors.RESOURCE_NOT_GIVEN));
  }
  if (!sourcePath) {
    throw Error(resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_GIVEN));
  }
  if (!fs.pathExistsSync(sourcePath)) {
    throw Error(resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_EXIST));
  }
  if (!outputPath) {
    throw Error(resourcesHelpers.formatError(resource, errors.OUTPUT_PATH_NOT_GIVEN));
  }
  if (fs.pathExistsSync(outputPath)) {
    fs.removeSync(outputPath);
  }

  console.log('processTranslationNotes', resource, sourcePath, outputPath);

  // const typesPath = path.join(sourcePath, 'bible');
  // const isDirectory = (item) => fs.lstatSync(path.join(typesPath, item)).isDirectory();
  // const typeDirs = fs.readdirSync(typesPath).filter(isDirectory);

  // typeDirs.forEach((typeDir) => {
  //   const typePath = path.join(typesPath, typeDir);
  //   const files = fs.readdirSync(typePath).filter((filename) => path.extname(filename) === '.md');
  //   // generateGroupsIndex(typePath, outputPath, typeDir);
  //   files.forEach((fileName) => {
  //     const sourcePath = path.join(typePath, fileName);
  //     const destinationPath = path.join(
  //       outputPath,
  //       typeDir,
  //       'articles',
  //       fileName,
  //     );
  //     fs.copySync(sourcePath, destinationPath);
  //   });
  // });
}
