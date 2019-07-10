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
 * @description Reads the contents of a url as a string.
 * @param {String} uri the url to read
 * @return {Promise.<string>} the url contents
 */
export function read(uri) {
  const parsedUrl = url.parse(uri, false, true);
  const makeRequest = parsedUrl.protocol === 'https:' ? https.request.bind(https) : http.request.bind(http);
  const serverPort = parsedUrl.port ? parsedUrl.port : parsedUrl.protocol === 'https:' ? 443 : 80;
  const agent = parsedUrl.protocol === 'https:' ? httpsAgent : httpAgent;

  const options = {
    host: parsedUrl.host,
    path: parsedUrl.path,
    agent: agent,
    port: serverPort,
    method: 'GET',
    headers: {'Content-Type': 'application/json'},
  };

  return new Promise((resolve, reject) => {
    const req = makeRequest(options, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode,
          data: data,
        });
      });
    });

    req.on('socket', (socket) => {
      socket.setTimeout(30000);
    });
    req.on('error', reject);
    req.end();
  });
}

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
        resolve({
          uri,
          dest,
          status: response.statusCode,
        });
      });
    });

    req.on('error', (error) => {
      file.end();
      rimraf.sync(dest);
      req.end();
      if (error.code && error.code === 'ERR_SOCKET_TIMEOUT' && retries + 1 < MAX_RETRIES) {
        console.warn(`socket timeout on resource ${uri} retrying`);
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
