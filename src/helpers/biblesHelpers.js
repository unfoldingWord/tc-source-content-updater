/* eslint-disable camelcase */
import fs from 'fs-extra';
import path from 'path-extra';
import yaml from 'yamljs';

/**
 * parse the manifest.yaml file into an object
 * @param {String} extractedFilePath - path with manifest.yaml
 * @return {Object} manifest data
 */
export function getResourceManifestFromYaml(extractedFilePath) {
  try {
    const filePath = path.join(extractedFilePath, 'manifest.yaml');
    const yamlManifest = fs.readFileSync(filePath, 'utf8');
    return yaml.parse(yamlManifest);
  } catch (error) {
    console.error(error);
  }
}

/**
 * generate manifest.json
 * @param {object} oldManifest - old manifest data
 * @param {String} RESOURCE_OUTPUT_PATH - folder to store manifest.json
 */
export function generateBibleManifest(oldManifest, RESOURCE_OUTPUT_PATH) {
  let newManifest = {};
  newManifest.dublin_core = oldManifest.dublin_core; // preserve original manifest data
  newManifest.checking = oldManifest.checking;
  newManifest.projects = oldManifest.projects;
  newManifest.original_manifest = oldManifest;

  // copy some data for more convenient access
  newManifest.language_id = oldManifest.dublin_core.language.identifier;
  newManifest.language_name = oldManifest.dublin_core.language.title;
  newManifest.direction = oldManifest.dublin_core.language.direction;
  newManifest.subject = oldManifest.dublin_core.subject;
  newManifest.resource_id = oldManifest.dublin_core.identifier;
  newManifest.resource_title = oldManifest.dublin_core.title;
  const oldMainfestIdentifier = oldManifest.dublin_core.identifier
                                      .toLowerCase();
  const identifiers = ['ugnt', 'ubh'];
  newManifest.description = identifiers.includes(oldMainfestIdentifier) ?
    'Original Language' : 'Gateway Language';

  let savePath = path.join(RESOURCE_OUTPUT_PATH, 'manifest.json');
  fs.outputJsonSync(savePath, newManifest);
}
