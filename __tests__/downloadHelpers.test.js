import * as helpers from '../src/helpers/downloadHelpers';
import fs from 'fs-extra';
import path from 'path-extra';
// constants
jest.unmock('../src/helpers/downloadHelpers');
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Download Helpers Test', () => {
  const destDir = 'imports/path/test';
  beforeEach(() => {
    fs.__resetMockFS();
    fs.ensureDirSync(destDir);
  });

  it('should test retries of socket timeout', () => {
    const url = 'https://cdn.door43.org/hi/irv/v1/tit.zip';
    const dest = path.join(destDir, 'tit.zip');
    return helpers.download(url, dest).then(() => {
      const filesDownloaded = fs.readdirSync(destDir).filter((name) => !name.includes('.DS_Store'));
      expect(filesDownloaded).toHaveLength(1);
    });
  });
});
