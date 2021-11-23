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

describe('apiHelpers.getCatalogCN', () => {
  it('should get the CN catalog', async () => {
    // eslint-disable-next-line no-debugger
    const data = await apiHelpers.doMultipartQuery('https://git.door43.org/api/catalog/v5/search?subject=Bible%2CAligned%20Bible%2CGreek_New_Testament%2CHebrew_Old_Testament%2CTranslation%20Words%2CTranslation%20Notes%2CTranslation%20Academy&sort=subject&limit=50');
    console.log(data);
    expect(data.length).toBeTruthy();
  });
});
