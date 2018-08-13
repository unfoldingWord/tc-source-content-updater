// helpers
import * as resourcesDownloadHelpers from '../src/helpers/resourcesDownloadHelpers';

describe('Tests for resourcesDownloadHelpers', function() {
  it('Test resourcesDownloadHelpers.processTranslationAcademy() for null', async () => {
    // given
    const resourceList = null;
    const expectedError = new Error('Resource list empty');

    // then
    await expect(resourcesDownloadHelpers.downloadResources(resourceList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for empty list', async () => {
    // given
    const resourceList = [];
    const expectedError = new Error('Resource list empty');

    // then
    await expect(resourcesDownloadHelpers.downloadResources(resourceList)).rejects.toEqual(expectedError);
  });

  it('Test resourcesDownloadHelpers.processTranslationAcademy() for populated list', async () => {
    // given
    const resourceList = [{languageId: 'en', resourceId: 'ult'}];
    const expectedResolve = 'success';

    // then
    await expect(resourcesDownloadHelpers.downloadResources(resourceList)).resolves.toEqual(expectedResolve);
  });
});
