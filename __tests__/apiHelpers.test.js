import * as apiHelpers from '../src/helpers/apiHelpers';

describe('apiHelpers.getCatalog', () => {
  it('should get the resulting catalog', () => {
    return apiHelpers.getCatalog().then(res => {
      expect(Array.isArray(res)).toBeTruthy();
      expect(res.length).toBeGreaterThan(56);
      res.forEach((item, idx) => {
        if (item.version) {
          expectMemberType(item, idx, 'version', 'string');
        }
        expectMemberType(item, idx, 'owner', 'string');
        expectMemberType(item, idx, 'languageId', 'string');
        expectMemberType(item, idx, 'resourceId', 'string');
        expectMemberType(item, idx, 'full_name', 'string');
        if (typeof item['checking_level'] !== 'number') { // can be either number or string type
          expectMemberType(item, idx, 'checking_level', 'string');
        }
        expectMemberType(item, idx, 'modified', 'string');
        expectMemberType(item, idx, 'subject', 'string');
        expectMemberType(item, idx, 'title', 'string');
        expectMemberType(item, idx, 'downloadUrl', 'string');
      });
    });
  }, 60000);
});

/**
 * check for valid value type in object item
 * @param {object} item
 * @param {number} idx
 * @param {string} key
 * @param {string} type
 */
function expectMemberType(item, idx, key, type) {
  const value = item[key];
  if (!value) {
    console.log(`For resource at ${idx}, value '${value}' for key '${key} should not be false - ${JSON.stringify(item)}`);
  }
  expect(value).toBeTruthy();
  const valueType = typeof value;
  if (!valueType) {
    console.log(`For resource at ${idx}, value '${value}' for key '${key} should be type '${type}', not '${valueType}' - ${JSON.stringify(item)}`);
  }
  expect(valueType).toEqual(type);
}
