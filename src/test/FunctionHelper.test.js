const { FunctionHelper } = require('../bin/FunctionHelper');
const { FcHelper } = require('../bin/FcHelper');
const Console = require('console');


jest.mock('@alicloud/fc-open20210406');

describe('all', () =>{
  describe('测试findBaseVersion', () => {
    const serviceName = 'testService';
    const aliasName = 'testAlias';
    let baseVersion;
    const newCreatedVersion = 4;
    const helper = new FunctionHelper(new FcHelper(), Console);

    test('baseVersion === null, if alias exists, baseVersion should be alias version', async () => {
      baseVersion = null;
      FcHelper.prototype.getAlias = jest.fn().mockImplementation(() => ({
        body: { versionId: '3' },
      }));
      expect(
        await helper.findBaseVersion(baseVersion, aliasName, serviceName, newCreatedVersion),
      ).toBe('3');
    });

    test("baseVersion === null, if alias doesn't exist, baseVersion should be one version before newCreatedVersion", async () => {
      baseVersion = null;
      FcHelper.prototype.getAlias = jest.fn().mockImplementation(() => {
        throw new Error('AliasNotFound');
      });
      FcHelper.prototype.listVersion = jest.fn().mockImplementation(() => ({
        body: { versions: [{ versionId: '4' }, { versionId: '3' }] },
      }));
      expect(
        await helper.findBaseVersion(baseVersion, aliasName, serviceName, newCreatedVersion),
      ).toBe('3');
    });

    test("baseVersion === null, if alias doesn't exist, baseVersion should be one version before newCreatedVersion, but newCreatedVersion is missing", async () => {
      baseVersion = null;
      FcHelper.prototype.getAlias = jest.fn().mockImplementation(() => {
        throw new Error('AliasNotFound');
      });
      FcHelper.prototype.listVersion = jest.fn().mockImplementation(() => ({
        body: { versions: [{ versionId: '5' }, { versionId: '3' }] },
      }));
      await expect(
        helper.findBaseVersion(baseVersion, aliasName, serviceName, newCreatedVersion),
      ).rejects.toThrowError(
        `New created version: ${newCreatedVersion} has been deleted.`,
      );
    });

    test("baseVersion === null, if alias exist or not, baseVersion should be one version before newCreatedVersion, but can't find a previous version", async () => {
      baseVersion = null;
      FcHelper.prototype.getAlias = jest.fn().mockImplementation(() => {
        throw new Error('AliasNotFound');
      });
      FcHelper.prototype.listVersion = jest.fn().mockImplementation(() => ({
        body: { versions: [{ versionId: '4' }] },
      }));
      await expect(
        helper.findBaseVersion(baseVersion, aliasName, serviceName, newCreatedVersion),
      ).rejects.toThrowError(`New created version is the oldest version, can't find a baseVersion`);
    });

    test('baseVersion !== null, if alias exist or not, baseVersion should be direct return', async () => {
      baseVersion = '5';
      expect(
        await helper.findBaseVersion(baseVersion, aliasName, serviceName, newCreatedVersion),
      ).toEqual('5');
    });
  });

  describe('test updateTriggerListByAlias',  () => {
    const triggers = [{ triggerName: '123' }, { triggerName: '123' }];
    const functionName = 'testFunc';
    const aliasName = 'testAlias';
    const serviceName = 'serviceName';
    const helper = new FunctionHelper(new FcHelper(), Console);

    test('success', async () => {
      FcHelper.prototype.updateTriggerAlias = jest
        .fn()
        .mockImplementation((serviceName, functionName, k, aliasName) => ({
          body: { qualifier: aliasName },
        }));

      expect(await helper.updateTriggerListByAlias(triggers, functionName, aliasName, serviceName)).toEqual(undefined);
    });

    test('fail', async () => {
      FcHelper.prototype.updateTriggerAlias = jest
        .fn()
        .mockImplementation((serviceName, functionName, k, aliasName) => ({
          body: { qualifier: aliasName + '1' },
        }));

      await expect( helper.updateTriggerListByAlias(triggers, functionName, aliasName, serviceName)).rejects.toThrowError();
    });
  });

  // todo
  describe('updateCustomDomainListByAlias', () => {
    const serviceName = 'testService';
    const aliasName = 'testAlias';
    const customDomainList =  [
      {
        "domain": "123"
      },
      {
        "domain": "456"
      }
    ];
    const helper = new FunctionHelper(new FcHelper(), Console);
    test('success', async () => {

      FcHelper.prototype.getCustomDomain = jest.fn().mockImplementation(() => ({body: {routeConfig: {routes: [{qualifier: "1"}]}}}));
      FcHelper.prototype.updateCustomDomain = jest.fn().mockImplementation(() => ({body: {routeConfig: {routes: [{qualifier: aliasName}]}}}));

      expect(await helper.updateCustomDomainListByAlias(serviceName, customDomainList, aliasName)).toBe(undefined);

    })

    test('error', async () => {
      FcHelper.prototype.getCustomDomain = jest.fn().mockImplementation(() => ({body: {routeConfig: {routes: [{qualifier: "1"}]}}}));
      FcHelper.prototype.updateCustomDomain = jest.fn().mockImplementation(() => ({body: {routeConfig: {routes: [{qualifier: 123}]}}}));

      await expect( helper.updateCustomDomainListByAlias(serviceName, customDomainList, aliasName)).rejects.toThrowError();
    })
  })
});


