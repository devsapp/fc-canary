const { FcHelper } = require('../bin/FcHelper');
const { printObject } = require('../utils/objectUtils');
const { validateArgs, validateCanaryStrategy } = require('./validate/validateArgs');
const { FunctionHelper } = require('../bin/FunctionHelper');
const { canaryWeightHelper, fullyReleaseHelper } = require('./canaryWeight');
const { Logger } = require('@serverless-devs/core');
const logger = new Logger('fc-canary');
const _ = require('lodash');

/**
 * if the yaml contains single function.
 * @returns {Promise<void>}
 */
async function singleFunc(inputs, args) {


  const config = {
    endpoint: `${inputs.credentials.AccountID}.${inputs.props.region}.fc.aliyuncs.com`,
    accessKeyId: inputs.credentials && inputs.credentials.AccessKeyID,
    accessKeySecret: inputs.credentials && inputs.credentials.AccessKeySecret,
    regionId: inputs.props && inputs.props.region,
  };

  // logger.log(`${JSON.stringify(config, null, 2)}`);
  const fcHelper = new FcHelper(config, logger);

  // ----------------
  // todo delete the credentials before log
  // delete (inputs.credentials);
  logger.log(`inputs params without credentials: ${JSON.stringify(inputs, null, 2)}`);
  logger.log(`args params: ${printObject(args)}`);

  // validate args
  await validateArgs(inputs, args, logger, fcHelper);

  const functionName = inputs.props && inputs.props.function && inputs.props.function.name;
  const serviceName = inputs.props && inputs.props.service && inputs.props.service.name;
  const { triggers = [] } = inputs.props;

  const { custom_domain: customDomainList = [] } = inputs.output.url;

  if (serviceName === undefined) {
    throw new Error(`serviceName is undefined`);
  }
  if (functionName === undefined) {
    throw new Error(`functionName is undefined`);
  }

  const {
    service: argService = serviceName,
    baseVersion: baseVersionArgs = null,
    description = '',
    alias: aliasName = `${functionName}_stable}`,
  } = args;

  // check user's grayscale strategy.
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

  const functionHelper = new FunctionHelper(fcHelper, logger);

  const newCreatedVersion = await functionHelper.publishVersion(argService, description);
  // check if alias exists
  const getAliasResponse = await functionHelper.getAlias(argService, aliasName);

  if (strategy.key === 'full') {
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
      logger
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
        logger
      );
    }
  }

}

module.exports = { singleFunc };
