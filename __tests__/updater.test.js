import Updater from '../src';
import fs from 'fs-extra';
import nock from 'nock';

jest.mock('../src/helpers/downloadHelpers');
jest.mock('../src/helpers/zipFileHelpers');

const catalog = require('../__tests__/fixtures/catalog.json');
nock('https://api.door43.org:443')
  .persist()
  .get('/v3/subjects/pivoted.json')
  .reply(200, JSON.stringify(catalog));

describe('Updater.downloadResources', () => {
  const resourcesPath = '/tmp/resources'; // a mocked resources directory

  beforeEach(() => {
    fs.__resetMockFS();
  });

  afterEach(() => {
    fs.__resetMockFS();
  });

  it('should resolve', async () => {
    const updater = new Updater();
    await updater.downloadResources(['grc'], resourcesPath)
    .then(resources => {
      expect(resources.length).toEqual(1);
    })
    .catch(err => {
      console.log(err);
      expect(err).not.toBeTruthy(); // should never get here
    });
  });

  it('should fail', async () => {
    const updater = new Updater();
    await updater.downloadResources()
    .then(res => {
      expect(res).toEqual('we should not be here'); // should never get here
    })
    .catch(err => {
      expect(err).toEqual('Language list is empty');
    });
  });
});
