import * as helpers from '../src/helpers/downloadHelpers';
import fs from 'fs-extra';
import path from 'path-extra';
import './__nocks__';
jest.unmock('../src/helpers/downloadHelpers');
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Download Helpers Test', () => {
  const destDir = 'imports/path/test';
  beforeEach(() => {
    fs.__resetMockFS();
    fs.ensureDirSync(destDir);
  });

  it('should download a resource without retries', () => {
    const url = 'https://cdn.door43.org/hi/irv/v1/tit.zip';
    const dest = path.join(destDir, 'tit.zip');
    return helpers.download(url, dest).then(() => {
      const filesDownloaded = fs.readdirSync(destDir).filter((name) => !name.includes('.DS_Store'));
      expect(filesDownloaded).toHaveLength(1);
    });
  });

  it('should download a resource with 1 retries', () => {
    const url = 'https://retry.org/1';
    const dest = path.join(destDir, 'tit.zip');
    return helpers.download(url, dest).then(() => {
      const filesDownloaded = fs.readdirSync(destDir).filter((name) => !name.includes('.DS_Store'));
      expect(filesDownloaded).toHaveLength(1);
    });
  });

  it('should download a resource with 2 retries', () => {
    const url = 'https://retry.org/2';
    const dest = path.join(destDir, 'tit.zip');
    return helpers.download(url, dest).then(() => {
      const filesDownloaded = fs.readdirSync(destDir).filter((name) => !name.includes('.DS_Store'));
      expect(filesDownloaded).toHaveLength(1);
    });
  });

  it('should not download a resource if retries more than 3 times', () => {
    const url = 'https://retry.org/4';
    const dest = path.join(destDir, 'tit.zip');
    return helpers.download(url, dest).catch((e) => {
      expect(e.code).toBe('ERR_SOCKET_TIMEOUT');
      const filesDownloaded = fs.readdirSync(destDir).filter((name) => !name.includes('.DS_Store'));
      expect(filesDownloaded).toHaveLength(0);
    });
  });
});
