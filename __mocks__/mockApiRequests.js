import nock from 'nock';

const catalog = require('../__tests__/fixtures/catalog.json');

nock('https://api.door43.org:443')
  .persist()
  .get('/v3/catalog.json')
  .reply(200, JSON.stringify(catalog));
