import url from 'url';
import fs from 'fs-extra';
import path from 'path-extra';

/**
 * @description Reads the contents of a url as a string.
 * @param {String} uri the url to read
 * @return {Promise.<string>} the url contents
 */
export function read(uri) {
  let parsedUrl = url.parse(uri, false, true);

  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, '../../../__tests__/fixtures', parsedUrl.host, parsedUrl.path);
    resolve({
      status: 200,
      data: fs.__actual.readFileSync(filePath)
    });
  });
}

/**
 * @description Downloads a url to a file.
 * @param {String} uri the uri to download
 * @param {String} dest the file to download the uri to
 * @param {Function} progressCallback receives progress updates
 * @return {Promise.<{}|Error>} the status code or an error
 */
export function download(uri, dest, progressCallback) {
  progressCallback = progressCallback || function() {};
  let parsedUrl = url.parse(uri, false, true);

  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, '../../../__tests__/fixtures', parsedUrl.host, parsedUrl.path);
    fs.writeFileSync(dest, fs.__actual.readFileSync(filePath));
    resolve({
      uri,
      dest,
      status: 200
    });
  });
}
