import Updater from '../src';
import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
// constants
import * as errors from '../src/resources/errors';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Updater.downloadResources', () => {
  const resourcesPath = path.join(ospath.home(), 'translationCore/resources'); // a mocked resources directory

  beforeEach(() => {
    fs.__resetMockFS();
    fs.ensureDirSync(resourcesPath);
  });

  it('should resolve for grc', async () => {
    const updater = new Updater();
    const resources = await updater.downloadResources(['grc'], resourcesPath);
    expect(resources.length).toEqual(1);
  });

  it('should fail due to language list empty', async () => {
    const updater = new Updater();
    const expectedError = errors.LANGUAGE_LIST_EMPTY;
    expect(updater.downloadResources()).rejects.toEqual(expectedError);
  });

  it('should fail due to resources path not given', async () => {
    const updater = new Updater();
    const languageIds = ['en'];
    const expectedError = errors.RESOURCES_PATH_NOT_GIVEN;
    expect(updater.downloadResources(languageIds)).rejects.toEqual(expectedError);
  });
});
