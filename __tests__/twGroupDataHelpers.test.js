import fs from 'fs-extra';
import path from 'path-extra';
import ospath from 'ospath';
// helpers
import * as twGroupDataHelpers from '../src/helpers/translationHelps/twGroupDataHelpers';
import * as resourcesHelpers from '../src/helpers/resourcesHelpers';
// constants
import * as errors from '../src/resources/errors';

describe('Test twGroupDataHelpers.generateTwGroupDataFromAlignedBible()', function() {
  const resource = {
    languageId: 'el-x-koine',
    resourceId: 'ugnt',
    version: '0.2',
  };
  const bibleRealPath = path.join(__dirname, 'fixtures/resources/el-x-koine/bibles/ugnt/v0.2');
  const sourcePath = path.join(ospath.home(), 'translationCore/resources/imports/el-x-koine_ugnt_processed');
  const outputPath = path.join(ospath.home(), 'translationCore/resources/imports/el-x-koine_tw_processed');

  beforeEach(() => {
    fs.__resetMockFS();
    fs.__loadDirIntoMockFs(bibleRealPath, sourcePath);
  });

  afterEach(() => {
    fs.__resetMockFS();
  });

  it('Test that milestones are properly constructed using inchrist for phm', () => {
    // when
    const result = twGroupDataHelpers.generateTwGroupDataFromAlignedBible(resource, sourcePath, outputPath);
    const jsonFile = path.join(outputPath, 'kt', 'groups', 'phm', 'inchrist.json');

    // then
    expect(result).toBeTruthy();
    expect(fs.existsSync(jsonFile)).toBeTruthy();
    const data = JSON.parse(fs.readFileSync(jsonFile));
    expect(data).toMatchSnapshot();
    const expectedItems = 5;
    expect(data.length).toEqual(expectedItems);
  });

  it('Test that occurrence of God is correct in Titus 1:1', () => {
    // when
    const result = twGroupDataHelpers.generateTwGroupDataFromAlignedBible(resource, sourcePath, outputPath);

    // then
    expect(result).toBeTruthy();
    const jsonFile = path.join(outputPath, 'kt', 'groups', 'tit', 'god.json');
    expect(fs.existsSync(jsonFile)).toBeTruthy();
    const data = JSON.parse(fs.readFileSync(jsonFile));
    const expectedOccurrence = 2;
    expect(data[1].contextId.occurrence).toEqual(expectedOccurrence);
  });

  it('Test twGroupDataHelpers.generateTwGroupDataFromAlignedBible() for invalid resource', () => {
    const resource = null;
    const expectedError = resourcesHelpers.formatError(resource, errors.RESOURCE_NOT_GIVEN);
    expect(() => twGroupDataHelpers.generateTwGroupDataFromAlignedBible(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test twGroupDataHelpers.generateTwGroupDataFromAlignedBible() for invalid source path', () => {
    const sourcePath = '/bad/path';
    const expectedError = resourcesHelpers.formatError(resource, errors.SOURCE_PATH_NOT_EXIST);
    expect(() => twGroupDataHelpers.generateTwGroupDataFromAlignedBible(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });

  it('Test twGroupDataHelpers.generateTwGroupDataFromAlignedBible() for output path not given', () => {
    const outputPath = null;
    const expectedError = resourcesHelpers.formatError(resource, errors.OUTPUT_PATH_NOT_GIVEN);
    expect(() => twGroupDataHelpers.generateTwGroupDataFromAlignedBible(resource, sourcePath, outputPath)).toThrowError(expectedError);
  });
});
