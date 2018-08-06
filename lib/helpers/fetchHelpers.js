'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

exports.getCatalog = getCatalog;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var request = require('request');
var DCS_API = 'https://api.door43.org';
var CATALOG_PATH = '/v3/catalog.json';

/**
 * @return {Object} - Catalog from the DCS API
 */
function getCatalog() {
  return new _promise2.default(function (resolve, reject) {
    request(DCS_API + CATALOG_PATH, function (error, response, body) {
      if (error) reject(error);else if (response.statusCode === 200) {
        try {
          var result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}