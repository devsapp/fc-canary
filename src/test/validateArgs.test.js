const { validateArgs, validateCanaryStrategy } = require('../lib/validate/validateArgs');
const console = require('console');
const { FcHelper } = require('../bin/FcHelper');
let inputs;
let args;

jest.mock('../bin/FcHelper');

jest.mock('@alicloud/fc-open20210406');
describe('Test validateArgs', () => {
  describe('Function: validateArgs', () => {
    FcHelper.prototype.listVersion = jest.fn().mockImplementation(() => ({
      body: { versions: [{ versionId: '1' }] },
    }));

    beforeEach(() => {
      inputs = {
        props: {
          region: 'cn-hangzhou',
          service: {
            name: 'dummy-service',
            logConfig: 'auto',
            nasConfig: 'auto',
          },
          function: {
            handler: 'index.handler',
            instanceType: 'e1',
            memorySize: 1024,
            runtime: 'nodejs12',
            timeout: 60,
            name: 'dummy-function',
            codeUri: '.',
          },
          triggers: [
            {
              name: 'httpTrigger',
              type: 'http',
              config: {
                authType: 'anonymous',
                methods: ['GET'],
              },
            },
          ],
          customDomains: [
            {
              domainName: 'auto',
              protocol: 'HTTP',
              routeConfigs: [
                {
                  path: '/*',
                },
              ],
            },
            {
              domainName: 'wordpress.web-framework.1816647648916833.cn-hangzhou.fc.devsapp.net',
              protocol: 'HTTP',
              routeConfigs: [
                {
                  path: '/*',
                },
              ],
            },
          ],
        },
        appName: 'demo-app',
        project: {
          component: 'devsapp/fc',
          access: 'mac0307',
          projectName: 'dummy-function',
        },
        command: 'deploy',
        args: '',
        argsObj: [],
        path: {
          configPath: '/Users/nanxuanli/work/plugin/fc-canary/example/singleFunc/s.yaml',
        },
        output: {
          region: 'cn-hangzhou',
          service: {
            name: 'dummy-service',
          },
          function: {
            name: 'dummy-function',
            runtime: 'nodejs12',
            handler: 'index.handler',
            memorySize: 1024,
            timeout: 60,
          },
          url: {
            custom_domain: [
              {
                domain:
                  'http://dummy-function.dummy-service.1816647648916833.cn-hangzhou.fc.devsapp.net',
              },
              {
                domain:
                  'http://wordpress.web-framework.1816647648916833.cn-hangzhou.fc.devsapp.net',
              },
            ],
          },
          triggers: [
            {
              type: 'http',
              name: 'httpTrigger',
            },
          ],
        },
      };

      args = {
        alias: 'stable',
        baseVersion: 1,
        canaryWeight: 110,
      };
    });
    //   service: test-service
    //   alias: stable
    //   describtion: 'test canary'
    //   baseVersion: 1 #基线版本，如果指定则使用该版本做为主版本和灰度版本进行切换
    //   canaryStep: # 灰度20%流量，10分钟后灰度剩余80%流量
    //   weight: 20
    //   interval: 10
    // # canaryWeight: 10 #手动灰度，指定时直接将灰度版本设置对应的权重
    // # canaryPlans: #自定义灰度
    // #   - weight: 10
    // #     intervalMinutes: 5
    // #   - weight: 30
    // #     intervalMinutes: 10

    test('args 的service和 inputs 不一致', async () => {
      args.service = 'xxx';
      await expect(validateArgs(inputs, args, console, new FcHelper())).rejects.toThrowError(
        `The plugin's service is unequal to service deployed. ` +
          `Name of service in the plugin: ${args.service}` +
          ` Name of service deployed: ${inputs.props.service.name}`,
      );
    });

    test('args baseVersion不是有效的', async () => {
      args.baseVersion = 10;
      args.service = 'dummy-service';
      await expect(validateArgs(inputs, args, console, new FcHelper())).rejects.toThrowError(
        `BaseVersion is not valid. baseVersion: ${args.baseVersion}, serviceName: ${args.service}`,
      );
    });

    test('args baseVersion有效，baseVersion: 1', async () => {
      args.baseVersion = 1;
      expect(await validateArgs(inputs, args, console, new FcHelper())).toBe(undefined);
    });
  });
  describe('Canary 参数测试', () => {
    beforeEach(() => {
      args = {
        alias: 'stable',
        baseVersion: 1,
      };
    });

    test('canary weight 等于100', async () => {
      args.canaryWeight = 100;
      expect(validateCanaryStrategy(args, console)).toEqual({ key: 'canaryWeight', value: 100 });
    });
    test('canary weight 大于100', () => {
      args.canaryWeight = 101;
      try {
        expect(validateCanaryStrategy(args, console));
      } catch (e) {
        expect(e.message).toEqual(
          `canaryWeight can't have a weight > 100, current weight: ${args.canaryWeight}`,
        );
      }
    });
    test('canary weight 没写value', () => {
      args.canaryWeight = undefined;
      try {
        expect(validateCanaryStrategy(args, console));
      } catch (e) {
        expect(e.message).toEqual(
          `CanaryWeight's format error, please double check the canaryWeight in the yaml.`,
        );
      }
    });

    test('canaryPlans 没写plan', () => {
      args.canaryPlans = undefined;
      try {
        expect(validateCanaryStrategy(args, console));
      } catch (e) {
        expect(e.message).toEqual(
          `CanaryPlans' format error, please double check the canaryPlans in the yaml.`,
        );
      }
    });

    test('canaryPlans一个plan没写weight', () => {
      args.canaryPlans = [{ weight: 4, interval: 4 }, { interval: 4 }];
      try {
        expect(validateCanaryStrategy(args, console));
      } catch (e) {
        expect(e.message).toEqual(`Weight is required`);
      }
    });
    test('canaryPlans一个plan没写interval', () => {
      args.canaryPlans = [{ weight: 4, interval: 4 }, { weight: 4 }];
      try {
        expect(validateCanaryStrategy(args, console));
      } catch (e) {
        expect(e.message).toEqual(`Interval is required`);
      }
    });

    test('canaryPlans一个weight>100', () => {
      args.canaryPlans = [
        { weight: 4, interval: 4 },
        { weight: 120, interval: 4 },
      ];
      try {
        expect(validateCanaryStrategy(args, console));
      } catch (e) {
        expect(e.message).toEqual(`Plans in canaryPlans can't have a weight > 100`);
      }
    });
    test('canaryPlans一个weight<100', () => {
      args.canaryPlans = [
        { weight: 4, interval: 4 },
        { weight: -1, interval: 4 },
      ];
      try {
        expect(validateCanaryStrategy(args, console));
      } catch (e) {
        expect(e.message).toEqual(`Plans in canaryPlans can't have a weight <= 0`);
      }
    });
    test('canaryPlans正常', () => {
      args.canaryPlans = [
        { weight: 4, interval: 4 },
        { weight: 4, interval: 4 },
      ];
      expect(validateCanaryStrategy(args, console)).toEqual({
        key: 'canaryPlans',
        value: [
          { weight: 4, interval: 4 },
          { weight: 4, interval: 4 },
        ],
      });
    });

    test('canaryPlans正常', () => {
      args.canaryPlans = [
        { weight: 4, interval: 4 },
        { weight: 4, interval: 4 },
      ];
      expect(validateCanaryStrategy(args, console)).toEqual({
        key: 'canaryPlans',
        value: [
          { weight: 4, interval: 4 },
          { weight: 4, interval: 4 },
        ],
      });
    });

    test('canaryStep正常', () => {
      args.canaryStep = { weight: 4, interval: 4 };

      expect(validateCanaryStrategy(args, console)).toEqual({
        key: 'canaryStep',
        value: { weight: 4, interval: 4 },
      });
    });

    test('canaryStep 没有weight', () => {
      args.canaryStep = { interval: 4 };
      try {
        expect(validateCanaryStrategy(args, console));
      } catch (e) {
        expect(e.message).toEqual(`Weight is required, grayscale strategy: canaryStep`);
      }
    });

    test('canaryStep weight<0', () => {
      args.canaryStep = { interval: 4, weight: -1 };
      try {
        expect(validateCanaryStrategy(args, console));
      } catch (e) {
        expect(e.message).toEqual(
          `Grayscale strategy: canaryStep can't have a weight <= 0, current weight: -1`,
        );
      }
    });
  });
});
