jest.unmock('fs-extra');
import Updater from '../src';
import nock from 'nock';
import tmp from 'tmp';
import rimraf from 'rimraf';

const catalog = require('./fixtures/catalog');

nock('https://api.door43.org:443', {"encodedQueryParams":true})
  .get('/v3/catalog.json')
  .reply(200, JSON.stringify(catalog));

describe('Updater.downloadResources', () => {
  let resourcesPath = null;

  beforeEach(() => {
    resourcesPath = tmp.dirSync({prefix: 'resources_'});
  });

  afterEach(() => {
    rimraf(resourcesPath.name, () => {
      console.log('done');
    });
  });

  it('should resolve', async () => {
    const updater = new Updater();
    const res = await updater.downloadResources(['grc'], resourcesPath.name);
    expect(res.length).toEqual(1);
  });

  it('should fail', async () => {
    const updater = new Updater();
    return await updater.downloadResources().catch(e => {
      expect(e.message).toBe('Resource list is empty');
    });
  });
});
