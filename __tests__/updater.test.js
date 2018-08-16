jest.unmock('fs-extra');
import Updater from '../src';
import tmp from 'tmp';
import fs from 'fs-extra';
import rimraf from 'rimraf';

describe('Updater.downloadResources', () => {
  let resourcesPath = null;

  beforeEach(() => {
    resourcesPath = tmp.dirSync({prefix: 'resources_'});
  });

  afterEach(() => {
    console.log(resourcesPath.name);
    rimraf(resourcesPath.name, fs, () => {});
  });

  it('should resolve', async () => {
    const updater = new Updater();
    await updater.downloadResources(['grc'], resourcesPath.name)
    .then(resources => {
      expect(resources.length).toEqual(1);
    })
    .catch(err => {
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
