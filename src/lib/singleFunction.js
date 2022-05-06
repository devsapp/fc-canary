const { FcHelper } = require('../bin/FcHelper');
const { printObject } = require('../utils/objectUtils');
const { validateParams, checkCanaryPolicy } = require('./validate/validateArgs');
const { FunctionHelper } = require('../bin/FunctionHelper');
const { canaryWeightHelper } = require('./canary/canaryWeight');
const { fullyReleaseHelper } = require('./canary/fullyRelease');
const { Logger } = require('@serverless-devs/core');
const logger = new Logger('fc-canary');
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
  logger.debug(`Inputs params without credentials: ${JSON.stringify(inputs, null, 2)}.`);
  logger.debug(`Args params: ${printObject(args)}.`);

  const functionName = inputs.props && inputs.props.function && inputs.props.function.name;
  const serviceName = inputs.props && inputs.props.service && inputs.props.service.name;
  const { triggers = [] } = inputs.props;

  // TODO 会不会上个post插件删除inputs.output导致我这里拿不到custom domain
  const { custom_domain: customDomainList = [] } = inputs.output && inputs.output.url;

  // validate
  await validateParams(logger, serviceName, functionName, inputs, args, fcHelper);

  const policy = checkCanaryPolicy(args, logger);

  logger.info('Successfully checked args, inputs and canary policy.');

  const {
    service: argService = serviceName,
    baseVersion = undefined,
    description = '',
    alias: aliasName = `${functionName}_stable`,
  } = args;

  // if baseVersion is set, we convert it to a string.
  let baseVersionArgs = baseVersion;
  if (baseVersionArgs != undefined) {
    baseVersionArgs = baseVersionArgs.toString();
  }
  // publish a new version.

  logger.debug(`Begin to publish a new version, serviceName: [${serviceName}].`);
  const newCreatedVersion = await functionHelper.publishVersion(argService, description);
  logger.info(`Successfully published the version: [${newCreatedVersion}].`);

  logger.debug(`Begin to check the existence of alias: [${aliasName}].`);
  const getAliasResponse = await functionHelper.getAlias(argService, aliasName);
  logger.info(
    `Successfully checked the existence of alias: [${aliasName}] ${
      getAliasResponse == undefined ? "doesn't exist, and we will create it soon" : 'exists'
    }.`,
  );
  if (policy.key === 'full') {
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
      getAliasResponse,
    );

    if (baseVersion === newCreatedVersion) {
      logger.warn(
        `The first release must be a full release, automatically ignoring the canary configuration.`,
      );

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

      return;
    }

    if (policy.key === 'canaryWeight') {
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
        policy.value / 100,
        customDomainList,
        logger,
      );
    }

    if (policy.key === 'canaryStep') {
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
        policy.value,
        customDomainList,
        logger,
      );
    }
    if (policy.key === 'canaryPlans') {
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
        policy.value,
        customDomainList,
        logger,
      );
    }

    if (policy.key == 'linearStep') {
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
        policy.value,
        customDomainList,
        logger,
      );
    }
  }
}

module.exports = { singleFunc };
