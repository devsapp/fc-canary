const {FcHelper} = require("./FcHelper");
const {printObject} = require("../utils/objectUtils");
const {validateArgs, validateGrayscaleStrategy} = require("../validate/argsValidate");
const {FunctionHelper} = require('./FunctionHelper');

const {Logger} = require("@serverless-devs/core");
const logger = new Logger("fc-canary");
const _ = require("lodash");


/**
 * if the yaml contains single function.
 * @returns {Promise<void>}
 */
async function singleFunc(inputs, args) {
  const config = {
    'endpoint': `${inputs.credentials.AccountID}.${inputs.props.region}.fc.aliyuncs.com`,
    'accessKeyId': inputs.credentials && inputs.credentials.AccessKeyID,
    'accessKeySecret': inputs.credentials && inputs.credentials.AccessKeySecret,
    'regionId': inputs.props && inputs.props.region
  }


  logger.log(`${JSON.stringify(config, null, 2)}`);
  const helper = new FcHelper(config, args, inputs, logger);

  // const versionResponse = await helper.listVersion('dummy-service');


// ----------------
  // todo delete the credentials before log
  // delete (inputs.credentials);
  logger.log(`inputs params without credentials: ${JSON.stringify(inputs, null, 2)}`);
  logger.log(`args params: {\n${printObject(args)}}`);
  await validateArgs(inputs, args, logger, helper);

  const functionName = inputs.function && inputs.function.name;
  const serviceName = inputs.props && inputs.props.service && inputs.props.service.name;
  const domainName = inputs.customDomains && inputs.customDomains.domainName;

  if (serviceName === undefined) {
    throw new Error(`serviceName is undefined`);
  }
  if (functionName === undefined) {
    throw new Error(`functionName is undefined`);
  }

  if (domainName === undefined) {
    throw new Error(`domainName is undefined`);
  }
  const {service = serviceName, baseVersion = null, description = '', alias = `${functionName}_stable}`} = args;

  const strategy = validateGrayscaleStrategy(args, logger);

  if (_.isEmpty(strategy)) {
    throw new Error(`System error, please contact staff, inputs: ${JSON.stringify(inputs, null, 2)}, args: ${printObject(args)}`);
  }

  if (strategy.key !== 'full' && baseVersion === null) {
    throw new Error(`baseVersion should be explicit when use grayscale`);
  }
  if (strategy.key === 'canaryWeight') {
    await canaryWeightHelper(helper, service, baseVersion, description, alias, strategy.value, logger);
  }

}

/**
 * if it is canaryWeight, set weight to alias.
 * @param helper
 * @param service
 * @param baseVersion
 * @param description
 * @param alias
 * @param grayWeight
 * @param domainName
 * @param logger
 * @returns {Promise<void>}
 */

async function canaryWeightHelper(helper, service, baseVersion, description, alias, grayWeight, domainName, logger) {

  const functionHelper = new FunctionHelper(helper, logger);

  // 1. publish version
  logger.log(`Begin to publish version`);
  const aliasVersion = await functionHelper.publishVersion(service, description);


  /* 2. find the baseVersion
  *   a. baseVersion === null
  *     - if alias exists, set the version of the alias to baseVersion
  *     - if alias doesn't exist, set the previous version of new created alias version to baseVersion
  *        - if the previous version doesn't exist, full release the alias and warning.
  *   b. baseVersion !== null
  *     - set baseVersion to alias.
  *
  */
  if (baseVersion === null) {
    baseVersion = await functionHelper.findBaseVersion(baseVersion, alias, service, aliasVersion);
  }
  this.logger.log(`Begin to create a new alias`);

  // 3. create alias
  const createAliasResponse = await this.helper.createAlias(service, baseVersion, alias, description, aliasVersion.toString(), 100);
  if (createAliasResponse === undefined || createAliasResponse.body === undefined) {
    throw new Error(`System error in creating alias, please contact the staff, service: ${service}, alias: ${alias}`);
  }
  if (createAliasResponse.body.aliasName !== alias) {
    throw new Error(`Create alias Error, response alias name: ${createAliasResponse.body.aliasName}, expected alias name: ${alias}`);
  }


  // 4. update triggers.
  const triggers = [];
  await helper.updateTriggerListByAlias(triggers);
  // 5. update customDomains.

  logger.log(`Begin to get the domain of service ${service}`);
  const domainResponse = await helper.getCustomDomain(domainName);
  const routeList = domainResponse.body && domainResponse.body.routeConfig && domainResponse.body.routeConfig.routes;
  if (routeList === undefined || routeList.constructor.name !== 'Array') {
    throw new Error(`Route configs of domain: ${domainName} is undefined, please contact the staff `);
  }
  for (const route of routeList) {
    route.qualifier = alias;
  }
  logger.log(`Begin to update the domain of service ${service}}, configs of routes ${routeList}`);
  const updateCustomDomainResponse = await helper.updateCustomDomain(domainName, routeList);
  if (updateCustomDomainResponse === undefined || updateCustomDomainResponse.body === undefined
    || updateCustomDomainResponse.body.routeConfig === undefined || updateCustomDomainResponse.body.routeConfig.routes === undefined) {
    throw new Error(`Update custom domain error, custom domain name: ${domainName}`);
  }
  // check if update successfully.
  const routesResponse = updateCustomDomainResponse.body.routeConfig.routes;
  if (_.isEmpty(routesResponse) !== _.isEmpty(routeList) && routeList.length !== routesResponse.length) {
    throw new Error(`Update custom domain error, the number of updated domains is not equal to the number of domains required to be updated. ` +
      `routes updated: ${routeList.length}, routes required to be updated: ${routeList.length}`);
  }
  for (const route of routesResponse) {
    if (route.qualifier !== alias) {
      throw new Error(`Update custom domain error, the qualifier (also called alias) is not updated`);
    }
  }

  logger.log(`Finish release`);
}

module.exports = {singleFunc}
