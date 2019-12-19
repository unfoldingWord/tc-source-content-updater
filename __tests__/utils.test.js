import {getQueryVariable} from '../src/helpers/utils';

describe('getQueryVariable()', () => {
  it('should return the correct version value for valid query', () => {
    const testCases = [
      {
        query: 'el-x-koine/ugnt?v=0.8',
        expected: '0.8',
      },
      {
        query: 'hbo/uhb?v=2.1.7',
        expected: '2.1.7',
      },
    ];
    testCases.forEach(({query, expected}) => {
      const result = getQueryVariable(query, 'v');

      expect(result).toEqual(expected);
    });
  });
});
