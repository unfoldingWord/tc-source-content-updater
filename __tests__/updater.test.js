import Updater from '../src';

describe('Updater.downloadResources', () => {
  it('should resolve', async () => {
    var updater = new Updater();
    const res = await updater.downloadResources(['en', 'hi']);
    expect(res).toBe('success');
  });

  it('should fail', async () => {
    var updater = new Updater();
    return await updater.downloadResources().catch(e => {
      expect(e.message).toBe('Resource list empty');
    });
  });
});
