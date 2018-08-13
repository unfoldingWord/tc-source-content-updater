// helpers
import * as resourcesDownloadHelpers from '../src/helpers/resourcesDownloadHelpers';

describe('Tests for resourcesDownloadHelpers', function() {
  it('Test resourcesDownloadHelpers.processTranslationAcademy() for null', () => {
    // given
    const resourceList = null;
    const expectedError = new Error('Resource list empty');

    // then
    expect(resourcesDownloadHelpers.downloadResources(resourceList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for empty list', () => {
    // given
    const resourceList = [];
    const expectedError = new Error('Resource list empty');

    // then
    expect(resourcesDownloadHelpers.downloadResources(resourceList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for populated list', () => {
    // given
    const resourceList = [{languageId: 'en', resourceId: 'ult'}];
    const expectedResolve = 'success';

    // then
    expect(resourcesDownloadHelpers.downloadResources(resourceList)).resolves.toEqual(expectedResolve);
  });
});
