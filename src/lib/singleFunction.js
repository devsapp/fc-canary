const { printObject } = require('../utils/objectUtils');
const {
  validateParams,
  parseCanaryPolicy,
  validateBaseVersion,
  isNoVersionInProject,
  checkNotificationPlans,
} = require('./validate/validateArgs');
const { FunctionHelper } = require('./fc/functionHelper');
const { canaryWeightHelper } = require('./canary/canaryWeight');
const { fullyReleaseHelper } = require('./canary/fullyRelease');
const { Logger } = require('@serverless-devs/core');
const logger = new Logger('fc-canary');
const { canaryStepHelper } = require('./canary/canaryStep');
const { canaryPlansHelper } = require('./canary/canaryPlans');
const { linearStepHelper } = require('./canary/linearStep');
const { CanaryWorker } = require('../lib/canary/canaryWorker');
const { NotificationHelper } = require('./notification/notificationHelper');
const { ExceptionHelper } = require('./exeception/exceptionHelper');
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
  const notificationPlans = checkNotificationPlans(args);
  const notificationHelper = new NotificationHelper(logger, notificationPlans);
  const exceptionHelper = new ExceptionHelper(notificationHelper);

  const functionHelper = new FunctionHelper(logger, config, exceptionHelper);

  delete inputs.credentials;
  logger.debug(`Inputs params without credentials: ${JSON.stringify(inputs, null, 2)}.`);
  logger.debug(`Args params: ${printObject(args)}.`);

  const functionName = inputs.props && inputs.props.function && inputs.props.function.name;
  const serviceName = inputs.props && inputs.props.service && inputs.props.service.name;
  const { triggers = [] } = inputs.props;

  // TODO 会不会上个post插件删除inputs.output导致我这里拿不到custom domain
  const { custom_domain: customDomainList = [] } = inputs.output && inputs.output.url;

  const { baseVersion, description = '', alias: aliasName = `${functionName}_stable` } = args;

  const params = { functionName, serviceName, customDomainList };

  await validateParams(logger, params, exceptionHelper);

  let policy = await parseCanaryPolicy(args, logger, exceptionHelper);
  if (
    policy.key !== 'full' &&
    (await isNoVersionInProject(functionHelper, serviceName, exceptionHelper))
  ) {
    logger.warn(
      `Although the canary policy is configured, there is no version in the service [${serviceName}] and the system will do a full release.`,
    );
    policy.key = 'full';
    policy.value = 100;
  }
  logger.info(`Canary Policy: ${policy.key} release.`);

  let baseVersionArgs;
  if (baseVersion !== undefined && policy.key !== 'full') {
    // if baseVersion is set, we convert it to a string.
    baseVersionArgs = baseVersion.toString();
    await validateBaseVersion(
      serviceName,
      baseVersionArgs,
      functionHelper,
      logger,
      exceptionHelper,
    );
  }

  logger.info('Successfully checked args, inputs and canary policy.');

  logger.debug(`Begin to publish a new version, serviceName: [${serviceName}].`);
  const canaryVersion = await functionHelper.publishVersion(serviceName, description);
  logger.info(`Successfully published the version: [${canaryVersion}].`);

  logger.debug(`Begin to check the existence of alias: [${aliasName}].`);
  const getAliasResponse = await functionHelper.getAlias(serviceName, aliasName);
  logger.info(
    `Successfully checked the existence of alias: [${aliasName}] ${
      getAliasResponse == undefined ? "doesn't exist, and we will create it soon" : 'exists'
    }.`,
  );

  if (policy.key === 'full') {
    const plan = fullyReleaseHelper(
      getAliasResponse,
      functionHelper,
      serviceName,
      description,
      canaryVersion,
      aliasName,
      triggers,
      functionName,
      customDomainList,
    );
    const worker = new CanaryWorker(logger, plan, functionHelper, notificationHelper);
    await worker.doJobs();
  } else {
    // 寻找baseVersion
    const baseVersion = await functionHelper.findBaseVersion(
      baseVersionArgs,
      aliasName,
      serviceName,
      canaryVersion,
      getAliasResponse,
    );
    if (policy.key === 'canaryWeight') {
      const plan = canaryWeightHelper(
        getAliasResponse,
        functionHelper,
        serviceName,
        baseVersion,
        description,
        canaryVersion,
        aliasName,
        triggers,
        functionName,
        policy.value,
        customDomainList,
      );
      const worker = new CanaryWorker(logger, plan, functionHelper, notificationHelper);
      await worker.doJobs();
      logger.info(`CanaryWeight release completed.`);
    }

    if (policy.key === 'canaryStep') {
      const plan = canaryStepHelper(
        getAliasResponse,
        functionHelper,
        serviceName,
        baseVersion,
        description,
        canaryVersion,
        aliasName,
        triggers,
        functionName,
        policy.value,
        customDomainList,
      );
      const worker = new CanaryWorker(logger, plan, functionHelper, notificationHelper);
      await worker.doJobs();
      logger.info(`CanaryStep release completed.`);
    }

    if (policy.key === 'canaryPlans') {
      const plan = canaryPlansHelper(
        getAliasResponse,
        functionHelper,
        serviceName,
        baseVersion,
        description,
        canaryVersion,
        aliasName,
        triggers,
        functionName,
        policy.value,
        customDomainList,
      );

      const worker = new CanaryWorker(logger, plan, functionHelper, notificationHelper);
      await worker.doJobs();
      logger.info(`CanaryPlans release completed.`);
    }

    if (policy.key == 'linearStep') {
      const plan = linearStepHelper(
        getAliasResponse,
        functionHelper,
        serviceName,
        baseVersion,
        description,
        canaryVersion,
        aliasName,
        triggers,
        functionName,
        policy.value,
        customDomainList,
      );
      const worker = new CanaryWorker(logger, plan, functionHelper, notificationHelper);
      await worker.doJobs();
      logger.info(`LinearStep release completed.`);
    }
  }
}

module.exports = { singleFunc };
