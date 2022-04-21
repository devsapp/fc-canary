const core = require('@serverless-devs/core');
const {validateArgs} = require("./validate/argsValidate");
const {lodash, Logger} = core;
const logger = new Logger('fc-canary');

/**
 * Plugin 插件入口
 * 这个插件是deploy之后执行
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
        service = `${serviceName}`,
        alias = `${functionName}_stable`,
        description = '',
        baseVersion = null,
        canaryStep ,
        canaryWeight,
        canaryPlans,
        linearStep
    } = args;

    logger.log(`service: ${service}\n` + `alias: ${alias}\n` + `description: ${description}\n` + `baseVersion: ${baseVersion}\n` + `canaryStep: ${JSON.stringify(canaryStep, null, 2)}\n` + `canaryWeight: ${JSON.stringify(canaryWeight, null, 2)}\n` + `linearStep: ${JSON.stringify(linearStep, null, 2)}\n` + `canaryPlans: ${JSON.stringify(canaryPlans, null, 2)}`);

    // delete conflict params
    deleteConflictParams(afterDeployParams);

    // validate args
    await validateArgs(afterDeployParams, args, logger);






};


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

