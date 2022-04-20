const core = require('@serverless-devs/core');
const path = require('path');
const parse = require("@serverless-devs/core/dist/common/load/parse");

const {lodash, Logger, loadComponent} = core;
const logger = new Logger('fc-canary');

/**
 * Plugin 插件入口
 * @param inputs 组件的入口参数
 * @param args 插件的自定义参数（详见README.md 基本参数 和 灰度策略）
 * @return inputs
 */

module.exports = async function index(inputs, args = {}) {

    // afterDeployParams will be used in the life circle of the plugin
    const afterDeployParams = lodash.assign({}, inputs);

    // delete the credentials before log
    delete (inputs.credentials);
    logger.log(`inputs params without credentials: ${JSON.stringify(inputs, null, 2)}`);
    logger.log(`args params: ${JSON.stringify(args, null, 2)}`);

    const {
        service = '${serviceName}',
        alias = '${functionName}_stable',
        description = '',
        baseVersion = null,
        canaryStep = {},
        canaryWeight = {},
        canaryPlans = {},
        linearStep = {}
    } = args;

    logger.debug(`service: ${service}\n` + `alias: ${alias}\n` + `description: ${description}\n` + `baseVersion: ${baseVersion}\n` + `canaryStep: ${JSON.stringify(canaryStep, null, 2)}\n` + `canaryWeight: ${JSON.stringify(canaryWeight, null, 2)}\n` + `linearStep: ${JSON.stringify(linearStep, null, 2)}\n` + `canaryPlans: ${JSON.stringify(canaryPlans, null, 2)}`);

    // delete conflict params
    deleteConflictParams(afterDeployParams);

    // validate args
    await validateArgs(afterDeployParams, args);

    // const instance = await loadComponent('devsapp/fc')
    //
    //
    // const newInputs = lodash.assign(afterDeployParams, {
    //     "args": "list --service-name dummy-service"
    // })


    // logger.log(`new inputs params: ${JSON.stringify(newInputs, null, 2)}`);
    //
    // const parsedArgs = core.commandParse(newInputs, {
    //     boolean: ['help', 'table', 'y'],
    //     string: ['region', 'service-name', 'description', 'id'],
    //     alias: {help: 'h', 'version-id': 'id', 'assume-yes': 'y'},
    // });
    //
    // console.log(parsedArgs);
    //
    //
    // const res = await instance.version(newInputs);
    //
    // console.log(res);
};

async function validateArgs(afterDeployParams, args) {
    const {
        service,
        baseVersion,
        canaryStep,
        canaryWeight,
        canaryPlans,
        linearStep
    } = args;

    // check whether service in the plugin args is equal to the service deployed.
    let curService;
    if (service !== undefined) {
        const serviceDeployed = afterDeployParams && afterDeployParams.props && afterDeployParams.props.service && afterDeployParams.props.service.name;
        if (serviceDeployed !== service) {
            throw new Error(`The plugin's service is unequal to service deployed.` + `Name of service in the plugin: ${service}` + `Name of service deployed: ${serviceDeployed}`)
        }
        curService = service;
    } else {
        curService = lodash.get(afterDeployParams, 'props.service.name');
    }

    if (baseVersion !== undefined) {
        await validateBaseVersion(curService, baseVersion, afterDeployParams);
    }

}

/**
 * FC component uses typescript, and the format of the input is fixed;
 * delete conflict params
 *
 * FC input interface:
 *
 * export interface IInputs {
 *     properties?: any;
 *     credentials?: any;
 *     project?: {
 *         projectName?: string;
 *         component?: string;
 *         provider?: string;
 *         accessAlias?: string;
 *     };
 *     command?: string;
 *     args?: string;
 *     state?: object;
 *     path?: {
 *         configPath?: string;
 *     };
 * }
 *
 * @param afterDeployParams
 */
function deleteConflictParams(afterDeployParams) {
    delete (afterDeployParams.appName);
    delete (afterDeployParams.project.access);
    delete (afterDeployParams.output);
    delete (afterDeployParams.argsObj);
}


/**
 * check whether baseVersion is validated online.
 * @returns {Promise<void>}
 */
async function validateBaseVersion(curService, baseVersion, afterDeployParams) {
    const fc = await loadComponent('devsapp/fc');
    const versionInputs = lodash.assign(afterDeployParams, {

        // todo: check whether we can access ${serviceName} in the code.
        // 'args': `list --service-name ${serviceName}`
        'args': `list --service-name ${curService}`
    })

    const versionList = await fc.version(versionInputs);

    // todo string to collection then check version.

    console.log(versionList[0].versionId);
}
