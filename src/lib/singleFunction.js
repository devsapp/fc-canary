const { FcHelper } = require('../bin/FcHelper');
const { printObject } = require('../utils/objectUtils');
const { validateArgs, validateCanaryStrategy } = require('./validate/validateArgs');
const { FunctionHelper } = require('../bin/FunctionHelper');
const { canaryWeightHelper } = require('./canary/canaryWeight');
const { fullyReleaseHelper } = require('./canary/fullyRelease');
const { Logger } = require('@serverless-devs/core');
const logger = new Logger('fc-canary');
const _ = require('lodash');
const { canaryStepHelper } = require('./canary/canaryStep');
const { canaryPlansHelper } = require('./canary/canaryPlans');
const { linerStepHelper } = require('./canary/linerStep');

/**
 * if the yaml contains single function.
 * @returns {Promise<void>}
 */
async function singleFunc(inputs, args) {
  const config = {
    endpoint: `${inputs.credentials.AccountID}.${inputs.props.region}.fc.aliyuncs.com`,
    accessKeyId: inputs.credentials && inputs.credentials.AccessKeyID,
    accessKeySecret: inputs.credentials && inputs.credentials.AccessKeySecret,
    securityToken: inputs.credentials && inputs.credentials.SecurityToken,
    regionId: inputs.props && inputs.props.region,
  };

  const fcHelper = new FcHelper(config, logger);
  const functionHelper = new FunctionHelper(fcHelper, logger);

  delete inputs.credentials;
  logger.debug(`Inputs params without credentials: ${JSON.stringify(inputs, null, 2)}`);
  logger.debug(`Args params: ${printObject(args)}`);

  const functionName = inputs.props && inputs.props.function && inputs.props.function.name;
  const serviceName = inputs.props && inputs.props.service && inputs.props.service.name;
  const { triggers = [] } = inputs.props;

  // TODO 会不会上个post插件删除inputs.output导致我这里拿不到custom domain
  const { custom_domain: customDomainList = [] } = inputs.output && inputs.output.url;

  if (serviceName == undefined) {
    throw new Error(`ServiceName is undefined`);
  }
  if (functionName == undefined) {
    throw new Error(`FunctionName is undefined`);
  }

  // validate args
  await validateArgs(inputs, args, logger, fcHelper);

  const {
    service: argService = serviceName,
    baseVersion: baseVersionArgs = undefined,
    description = '',
    alias: aliasName = `${functionName}_stable`,
  } = args;

  // check user's canary strategy.
  const strategy = validateCanaryStrategy(args, logger);

  if (_.isEmpty(strategy)) {
    throw new Error(
      `System error, please contact staff, inputs: ${JSON.stringify(
        inputs,
        null,
        2,
      )}, args: ${printObject(args)}`,
    );
  }

  logger.log(`The canary strategy is: \n${printObject(strategy)}`);

  const newCreatedVersion = await functionHelper.publishVersion(argService, description);

  // check if alias exists
  const getAliasResponse = await functionHelper.getAlias(argService, aliasName);

  if (strategy.key === 'full') {
    logger.log('Begin fully release');
    await fullyReleaseHelper(
      getAliasResponse,
      functionHelper,
      argService,
      description,
      newCreatedVersion,
      aliasName,
      triggers,
      functionName,
      customDomainList,
      logger,
    );
  } else {
    // 寻找baseVersion
    const baseVersion = await functionHelper.findBaseVersion(
      baseVersionArgs,
      aliasName,
      argService,
      newCreatedVersion,
    );

    if (strategy.key === 'canaryWeight') {
      logger.log('Begin canaryWeight release');
      await canaryWeightHelper(
        getAliasResponse,
        functionHelper,
        argService,
        baseVersion,
        description,
        newCreatedVersion,
        aliasName,
        triggers,
        functionName,
        strategy.value / 100,
        customDomainList,
        logger,
      );
    }

    if (strategy.key === 'canaryStep') {
      logger.log('Begin canaryStep release');
      await canaryStepHelper(
        getAliasResponse,
        functionHelper,
        argService,
        baseVersion,
        description,
        newCreatedVersion,
        aliasName,
        triggers,
        functionName,
        strategy.value,
        customDomainList,
        logger,
      );
    }

    if (strategy.key === 'canaryPlans') {
      logger.log('Begin canaryPlans release');
      await canaryPlansHelper(
        getAliasResponse,
        functionHelper,
        argService,
        baseVersion,
        description,
        newCreatedVersion,
        aliasName,
        triggers,
        functionName,
        strategy.value,
        customDomainList,
        logger,
      );
    }
    if (strategy.key === 'linearStep') {
      logger.log('Begin linearStep release');
      await linerStepHelper(
        getAliasResponse,
        functionHelper,
        argService,
        baseVersion,
        description,
        newCreatedVersion,
        aliasName,
        triggers,
        functionName,
        strategy.value,
        customDomainList,
        logger,
      );
    }
  }
}

module.exports = { singleFunc };
