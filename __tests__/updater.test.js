import Updater from '../src';
import fs from 'fs-extra';
import * as errors from '../src/errors';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Updater.downloadResources', () => {
  const resourcesPath = '/tmp/resources'; // a mocked resources directory

  beforeEach(() => {
    fs.__resetMockFS();
    fs.ensureDirSync(resourcesPath);
  });

  it('should resolve', async () => {
    const updater = new Updater();
    const resources = await updater.downloadResources(['grc'], resourcesPath);
    expect(resources.length).toEqual(1);
  });

  it('should fail', async () => {
    const updater = new Updater();
    const expectedError = errors.LANGUAGE_LIST_EMPTY;
    expect(updater.downloadResources()).rejects.toEqual(expectedError);
  });
});
