import * as apiHelpers from '../src/helpers/apiHelpers';

describe('apiHelpers.getCatalog', () => {
  it('should get the resulting catalog', () => {
    return apiHelpers.getCatalog().then(res => {
      expect(Array.isArray(res)).toBeTruthy();
      expect(res.length).toBeGreaterThan(64);
      res.forEach(item => {
        expect(item).toMatchObject({
          identifier: expect.any(String),
          version: expect.any(String),
          repo: expect.any(String),
          language: expect.any(String),
          modified: expect.any(String),
        });
      });
    });
  });
});
