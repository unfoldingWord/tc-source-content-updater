jest.mock('fs-extra');
import fs from 'fs-extra';
import path from 'path-extra';
// helpers
import * as twGroupDataHelpers from '../src/helpers/translationHelps/twGroupDataHelpers';

describe('Test twGroupDataHelpers.generateTwGroupDataFromAlignedBible()', function() {
  const lang = 'grc';
  const bible = 'ugnt';
  const version = 'v0.2';
  const bibleRealPath = path.join(__dirname, 'fixtures/resources', lang, 'bibles', bible, version);
  const bibleMockPath = path.join('/resources', lang, 'bibles', bible, version);
  const outputPath = path.join('/resources', lang, 'translationHelps/translationWords');

  beforeEach(() => {
    fs.__resetMockFS();
    fs.__loadDirIntoMockFs(bibleRealPath, bibleMockPath);
  });

  afterEach(() => {
    fs.__resetMockFS();
  });

  it('Test that milestones are properly constructed using inchrist for phm', () => {
    // given
    const expectedTwPath = path.join(outputPath, version);

    // when
    const generatedTwPath = twGroupDataHelpers.generateTwGroupDataFromAlignedBible(bibleMockPath, outputPath);
    const jsonFile = path.join(generatedTwPath, 'kt', 'groups', 'phm', 'inchrist.json');

    // then
    expect(generatedTwPath).toEqual(expectedTwPath);
    expect(fs.existsSync(jsonFile)).toBeTruthy();
    const data = JSON.parse(fs.readFileSync(jsonFile));
    expect(data).toMatchSnapshot();
    const expectedItems = 5;
    expect(data.length).toEqual(expectedItems);
  });

  it('Test that occurrence of God is correct in Titus 1:1', () => {
    // given
    const expectedTwPath = path.join(outputPath, version);

    // when
    const generatedTwPath = twGroupDataHelpers.generateTwGroupDataFromAlignedBible(bibleMockPath, outputPath);

    // then
    expect(generatedTwPath).toEqual(expectedTwPath);
    const jsonFile = path.join(generatedTwPath, 'kt', 'groups', 'tit', 'god.json');
    expect(fs.existsSync(jsonFile)).toBeTruthy();
    const data = JSON.parse(fs.readFileSync(jsonFile));
    const expectedOccurrence = 2;
    expect(data[1].contextId.occurrence).toEqual(expectedOccurrence);
  });

  it('Test twGroupDataHelpers.generateTwGroupDataFromAlignedBible() for invalid biblePath', () => {
    // given
    const biblePath = '/bad/path';
    const expectedGeneratedPath = null;

    // when
    const generatedTwPath = twGroupDataHelpers.generateTwGroupDataFromAlignedBible(biblePath, outputPath);

    // then
    expect(generatedTwPath).toEqual(expectedGeneratedPath);
  });
});
