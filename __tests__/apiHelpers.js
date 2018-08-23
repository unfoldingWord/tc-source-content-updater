import * as apiHelpers from '../src/helpers/apiHelpers';

describe('apiHelpers.getCatalog', () => {
  it('should get the resulting catalog', () => {
    return apiHelpers.getCatalog().then(res => {
      expect(res).toMatchObject({
        catalogs: expect.any(Array),
        subjects: expect.any(Array)
      });
    });
  });
});
