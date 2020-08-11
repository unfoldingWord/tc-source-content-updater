/* eslint-disable curly */
import url from 'url';
import {https, http} from 'follow-redirects';
import fs from 'fs-extra';
import rimraf from 'rimraf';
const HttpAgent = require('agentkeepalive');
const HttpsAgent = require('agentkeepalive').HttpsAgent;

const httpAgent = new HttpAgent();
const httpsAgent = new HttpsAgent();

const MAX_RETRIES = 3;

/**
 * @description Downloads a url to a file.
 * @param {String} uri the uri to download
 * @param {String} dest the file to download the uri to
 * @param {Function} progressCallback receives progress updates
 * @param {number} retries the amount of retries for socket timeouts
 * @return {Promise.<{}|Error>} the status code or an error
 */
export function download(uri, dest, progressCallback, retries = 0) {
  progressCallback = progressCallback || function() {};
  const parsedUrl = url.parse(uri, false, true);
  const makeRequest = parsedUrl.protocol === 'https:' ? https.request.bind(https) : http.request.bind(http);
  const serverPort = parsedUrl.port ? parsedUrl.port : parsedUrl.protocol === 'https:' ? 443 : 80;
  const agent = parsedUrl.protocol === 'https:' ? httpsAgent : httpAgent;
  const file = fs.createWriteStream(dest);
  const options = {
    host: parsedUrl.host,
    path: parsedUrl.path,
    agent: agent,
    port: serverPort,
    method: 'GET',
    timeout: 120000,
  };
  if (process.env.NODE_ENV === 'development') {
    options.rejectUnauthorized = false;
  }

  return new Promise((resolve, reject) => {
    const req = makeRequest(options, (response) => {
      const size = response.headers['content-length'];
      let progress = 0;

      response.on('data', (chunk) => {
        progress += chunk.length;
        progressCallback(size, progress);
      });

      response.pipe(file);
      file.on('finish', () => {
        fs.exists(dest, (exists) => {
          if (exists) {
            if (response.statusCode === 200) {
              resolve({
                uri,
                dest,
                status: response.statusCode,
              });
            } else {
              req.emit('error', `Download did not succeed, code ${response.statusCode}`);
              fs.removeSync(dest); // remove failed download attempt
            }
          } else {
            req.emit('error', 'Downloaded file does not exist');
          }
        });
      });
    });

    req.on('error', (error) => {
      file.end();
      rimraf.sync(dest);
      req.end();
      if (retries < MAX_RETRIES) {
        console.warn(`error on resource ${uri} retrying, error: ${error}`);
        setTimeout(() => {
          download(uri, dest, progressCallback, retries + 1).then(resolve).catch(reject);
        }, 500);
      } else {
        console.error(error);
        reject(error);
      }
    });

    req.end();
  });
}
