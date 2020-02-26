import {makeSureResourceUnzipped} from '../src/helpers/unzipFileHelpers';
import path from 'path-extra';
import ospath from 'ospath';
import fs from 'fs-extra';

// jest.unmock('fs-extra');
// jest.unmock('adm-zip');

// ////////////////////////////////
// mock adm-zip
let mockUnzipFolders = [];
const mockPath = path;
const mockFs = fs;

const mockExtractAllTo = jest.fn((destination) => {
  for (const folder of mockUnzipFolders) {
    const folderPath = mockPath.join(destination, folder);
    mockFs.ensureDirSync(folderPath);
  }
});

jest.mock('adm-zip', () =>
  // mocks Class initialization
  jest.fn().mockImplementation(() => ({extractAllTo: mockExtractAllTo}))
);

describe('makeSureResourceUnzipped()', () => {

  beforeEach(() => {
    fs.__resetMockFS();
  });

  it('should unzip bible', () => {
    // given
    const resource = 'bibles/maj-rp/v2000';
    const sourceFolder = path.join(__dirname, 'fixtures/compressedResources', resource);
    const tempFolder = 'translationCore/resources/en';
    const resourceFolder = path.join(tempFolder, resource);
    fs.__loadDirIntoMockFs(sourceFolder, resourceFolder);
    mockUnzipFolders = ['col'];

    // when
    makeSureResourceUnzipped(resourceFolder);

    // then
    expect(fs.existsSync(path.join(resourceFolder, 'books.zip'))).toBeFalsy();
    expect(fs.existsSync(path.join(resourceFolder, 'index.json'))).toBeTruthy();
    expect(fs.existsSync(path.join(resourceFolder, 'manifest.json'))).toBeTruthy();
    expect(fs.existsSync(path.join(resourceFolder, 'col'))).toBeTruthy();
  });

  it('should unzip helps', () => {
    // given
    const resource = 'translationHelps/translationAcademy/v11';
    const sourceFolder = path.join(__dirname, 'fixtures/compressedResources', resource);
    const tempFolder = 'translationCore/resources/en';
    const resourceFolder = path.join(tempFolder, resource);
    fs.__loadDirIntoMockFs(sourceFolder, resourceFolder);
    mockUnzipFolders = ['translate'];

    // when
    makeSureResourceUnzipped(resourceFolder);

    // then
    expect(fs.existsSync(path.join(resourceFolder, 'contents.zip'))).toBeFalsy();
    expect(fs.existsSync(path.join(resourceFolder, 'manifest.json'))).toBeTruthy();
    expect(fs.existsSync(path.join(resourceFolder, 'translate'))).toBeTruthy();
  });
});
