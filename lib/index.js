'use strict';

var _fetchHelpers = require('./helpers/fetchHelpers');

var fetchHelpers = _interopRequireWildcard(_fetchHelpers);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

fetchHelpers.getCatalog().then(console.log);