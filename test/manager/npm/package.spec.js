const npmApi = require('../../../lib/datasource/npm');
const versions = require('../../../lib/manager/npm/versions');
const npm = require('../../../lib/manager/npm/package');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

jest.mock('../../../lib/datasource/npm');
jest.mock('../../../lib/manager/_helpers/node/package');
npmApi.getDependency = jest.fn();

describe('lib/manager/npm/package', () => {
  describe('getRangeStrategy', () => {
    it('returns same if not auto', () => {
      const config = { rangeStrategy: 'widen' };
      expect(npm.getRangeStrategy(config)).toEqual('widen');
    });
    it('pins devDependencies', () => {
      const config = { rangeStrategy: 'auto', depType: 'devDependencies' };
      expect(npm.getRangeStrategy(config)).toEqual('pin');
    });
    it('pins app dependencies', () => {
      const config = {
        rangeStrategy: 'auto',
        depType: 'dependencies',
        packageJsonType: 'app',
      };
      expect(npm.getRangeStrategy(config)).toEqual('pin');
    });
    it('widens peerDependencies', () => {
      const config = { rangeStrategy: 'auto', depType: 'peerDependencies' };
      expect(npm.getRangeStrategy(config)).toEqual('widen');
    });
    it('widens complex ranges', () => {
      const config = {
        rangeStrategy: 'auto',
        depType: 'dependencies',
        currentVersion: '^1.6.0 || ^2.0.0',
      };
      expect(npm.getRangeStrategy(config)).toEqual('widen');
    });
    it('defaults to replace', () => {
      const config = { rangeStrategy: 'auto', depType: 'dependencies' };
      expect(npm.getRangeStrategy(config)).toEqual('replace');
    });
  });
  describe('getPackageUpdates', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
        depName: 'some-dep',
        currentVersion: '1.0.0',
      };
    });
    it('skips non-node engines', async () => {
      config.depType = 'engines';
      const res = await npm.getPackageUpdates(config);
      expect(res).toHaveLength(0);
    });
    it('calls node for node engines', async () => {
      config.depType = 'engines';
      config.depName = 'node';
      config.currentVersion = '8.9.0';
      const res = await npm.getPackageUpdates(config);
      expect(res).toBeUndefined();
    });
    it('returns if using a file reference', async () => {
      config.currentVersion = 'file:../sibling/package.json';
      const res = await npm.getPackageUpdates(config);
      expect(res).toHaveLength(0);
    });
    it('returns warning if using invalid version', async () => {
      config.currentVersion =
        'git+ssh://git@github.com/joefraley/eslint-config-meridian.git';
      const res = await npm.getPackageUpdates(config);
      expect(res).toMatchSnapshot();
    });
    it('returns warning if no npm dep found', async () => {
      const res = await npm.getPackageUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('warning');
      expect(npmApi.getDependency.mock.calls.length).toBe(1);
    });
    it('returns warning if warning found', async () => {
      npmApi.getDependency.mockReturnValueOnce({});
      versions.determineUpgrades = jest.fn(() => [
        {
          type: 'warning',
          message: 'bad version',
        },
      ]);
      const res = await npm.getPackageUpdates(config);
      expect(res[0].type).toEqual('warning');
    });
    it('returns array if upgrades found', async () => {
      npmApi.getDependency.mockReturnValueOnce({ repositoryUrl: 'some-url' });
      versions.determineUpgrades = jest.fn(() => [{}]);
      const res = await npm.getPackageUpdates(config);
      expect(res).toHaveLength(1);
      expect(Object.keys(res[0])).toMatchSnapshot();
      expect(res[0].repositoryUrl).toBeDefined();
    });
    it('sets repositoryUrl for @types', async () => {
      config.depName = '@types/some-dep';
      npmApi.getDependency.mockReturnValueOnce({});
      versions.determineUpgrades = jest.fn(() => [{}]);
      const res = await npm.getPackageUpdates(config);
      expect(res[0].repositoryUrl).toEqual(
        'https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/some-dep'
      );
    });
  });
});
