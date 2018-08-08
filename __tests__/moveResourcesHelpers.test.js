'use strict';
/*import fs from 'fs-extra';*/
import path from 'path-extra';
import * as moveResourcesHelpers from '../src/helpers/moveResourcesHelpers';

jest.mock('fs-extra');

describe('moveResourcesHelpers', () => {
  beforeEach(() => {
    const sourceFolder =  path.join(ospath.home(), 'translationCore', 'resources');
    fs.__resetMockFS({
      [sourceFolder]: 
    })
  });

  test('moveResources', () => {
    const resource = {
      translationCore: {
        resources: {
          bs: {
            bibles:{
              ulb: {
                v0: {
                  mat:{
                    '1.json': 'now is the time',
                    '2.json': 'for all good men'
                  },
                  'index.json': '',
                  'manifest.json':''
                }
              }
            },
            lexicons:{
              ugl: {
                v1: {
                  content: {
                    'beauty.json': 'a rose by any other name'
                  }
                }
              },
              uhl: {
                v5: {
                  content: {
                    'aleph.json': 'first letter of hebrew alphabet'
                  }
                }
              }
            },
            translationHelps: {
              translationAcademy: {
                v2: {
                  checking: {
                    'beauty.md': 'have you seen a rose' 
                  },
                  intro: {},
                  process: {},
                  translate: {}
                }
              },
              translationNotes: {
                v3: {
                  groups: {
                    mat: {
                      'category-topic.json': '',
                      'index.json': ''
                    }
                  }
                }
              },
              translationWords: {
                v4: {
                  kt: {
                    articles: {
                      'beauty.md': '',
                      'index.json': ''
                    }
                  },
                  names: {},
                  other: {}
                }
              }
            }
          }
        }
      }
    };
    const fromFolder = path.join('file');
    const languageCode = 'bs';
    moveResourcesHelpers.moveResources(fromFolder, languageCode);
  });
});


