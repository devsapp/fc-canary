const _ = require('lodash');
const assert = require('assert');

/**
 *
 * @param logger
 * @param params
 * @param exceptionHelper
 * @returns {Promise<void>}
 */
async function validateParams(logger, params, exceptionHelper) {
  if (params.serviceName == undefined) {
    await exceptionHelper.throwAndNotifyError(`Missing service name in inputs.`);
  }
  if (params.functionName == undefined) {
    await exceptionHelper.throwAndNotifyError(`Missing function name in inputs.`);
  }
  // check user's custom_domain.
  if (params.customDomainList.constructor.name !== 'Array') {
    await exceptionHelper.throwAndNotifyError(`Failed to parse custom domains.`);
  }
  if (params.triggers.constructor.name !== 'Array') {
    await exceptionHelper.throwAndNotifyError(`Failed to parse triggers.`);
  }
  if (params.triggers.length == 0) {
    await exceptionHelper.throwAndNotifyError(`No triggers found, you can't do a canary release without a trigger.`);
  }
}

/**
 * check if there is no version in the project.
 * @param functionHelper
 * @param service
 * @param exceptionHelper
 * @returns {Promise<boolean>}
 */
async function isNoVersionInProject(functionHelper, service, exceptionHelper) {

  const response = await functionHelper.listVersion(service, undefined, undefined);
  if (
    response == undefined ||
    response.body == undefined ||
    response.body.versions == undefined ||
    typeof response.body.versions[Symbol.iterator] !== 'function'
  ) {
    await exceptionHelper.throwAndNotifyError('Listing versions error, please contact the staff.');
  }
  return response.body.versions.length === 0;
}

/**
 * Canary policy, only one of the following parameters can be selected, if not specified then no canary policy
 * @param args
 * @param logger
 */
async function parseCanaryPolicy(args, logger, exceptionHelper) {
  let response = {};
  const argsKeys = Object.keys(args);
  logger.debug(`keys in args: [${argsKeys}].`);

  let policies = [];
  if (argsKeys.includes('canaryStep')) {
    policies.push('canaryStep');
  }
  if (argsKeys.includes('canaryWeight')) {
    policies.push('canaryWeight');
  }
  if (argsKeys.includes('canaryPlans')) {
    policies.push('canaryPlans');
  }
  if (argsKeys.includes('linearStep')) {
    policies.push('linearStep');
  }
  logger.debug(`User input canary policy: ${JSON.stringify(policies)}.`);

  if (policies.length === 0) {
    logger.warn(`No canary policy found, the system will perform a full release.`);

    response.key = 'full';
    response.value = 100;
  } else if (policies.length > 1) {
    await exceptionHelper.throwAndNotifyError(
      `Only one canary policy can be selected, but [${policies.length}] canary policies are found.`,
    );
  } else {
    // begin validate the strategy
    const canaryPolicyName = policies[0];

    if (canaryPolicyName === 'canaryPlans') {
      // each plan in canaryPlans can't have a weight > 100
      const plans = _.get(args, 'canaryPlans');
      logger.debug(`canaryPlans: [${plans}].`);

      if (plans == undefined) {
        await exceptionHelper.throwAndNotifyError(
          `Missing configuration of plan in canaryPlans, please check the configuration.`,
        );
      }

      for (const plan of _.get(args, 'canaryPlans')) {
        logger.debug(`plan: ${JSON.stringify(plan, null, 2)}.`);
        try {
          assert(
            plan.weight &&
              _.isNumber(plan.weight) &&
              Math.round(plan.weight) === plan.weight &&
              plan.weight >= 1 &&
              plan.weight <= 100,
            `Weight must be set as an integer, and 1 <= weight <= 100. `,
          );
          assert(
            plan.interval &&
              _.isNumber(plan.interval) &&
              Math.round(plan.interval) === plan.interval &&
              plan.interval >= 1,
            `Interval must be set as an integer, and 1 <= interval. `,
          );
        } catch (e) {
          await exceptionHelper.throwAndNotifyError(e.message);
        }
      }
      response.key = 'canaryPlans';
      response.value = _.get(args, 'canaryPlans');
    }

    // linearStep and canaryStep
    if (canaryPolicyName === 'linearStep' || canaryPolicyName === 'canaryStep') {
      const canaryPolicy = _.get(args, canaryPolicyName);
      if (canaryPolicy == undefined) {
        await exceptionHelper.throwAndNotifyError(
          `Missing configuration in [${canaryPolicyName}], please check the configuration.`,
        );
      }
      try {
        assert(
          canaryPolicy.weight &&
            _.isNumber(canaryPolicy.weight) &&
            Math.round(canaryPolicy.weight) === canaryPolicy.weight &&
            canaryPolicy.weight >= 1 &&
            canaryPolicy.weight <= 100,
          `Weight must be set as an integer, and 1 <= weight <= 100. `,
        );
      } catch (e) {
        await exceptionHelper.throwAndNotifyError(e.message);
      }

      if (canaryPolicy.interval == undefined) {
        if (canaryPolicyName === 'linearStep') {
          logger.warn(`No interval found, the system defaults to using 1 minute as the interval`);
          canaryPolicy.interval = 1;
        }
        if (canaryPolicyName === 'canaryStep') {
          logger.warn(`No interval found, the system defaults to using 10 minutes as the interval`);
          canaryPolicy.interval = 10;
        }
      } else {
        try {
          assert(
            _.isNumber(canaryPolicy.interval) &&
              Math.round(canaryPolicy.interval) === canaryPolicy.interval &&
              canaryPolicy.interval >= 1,
            `Interval must be set as an integer, and 1 <= interval. `,
          );
        } catch (e) {
          await exceptionHelper.throwAndNotifyError(e.message);
        }
      }
      response.key = `${canaryPolicyName}`;
      response.value = canaryPolicy;
    }

    // canaryWeight
    if (canaryPolicyName === 'canaryWeight') {
      const canaryWeight = _.get(args, 'canaryWeight');
      try {
        assert(
          canaryWeight &&
            _.isNumber(canaryWeight) &&
            Math.round(canaryWeight) === canaryWeight &&
            canaryWeight >= 1 &&
            canaryWeight <= 100,
          `Weight must be set as an integer, and 1 <= weight <= 100. `,
        );
      } catch (e) {
        await exceptionHelper.throwAndNotifyError(e.message);
      }

      response.key = 'canaryWeight';
      response.value = canaryWeight;
    }
  }
  return response;
}

/**
 * check whether baseVersion must exist online.
 * @param serviceName
 * @param baseVersionArgs
 * @param helper
 * @param logger
 * @param exceptionHelper
 * @returns {Promise<void>}
 */
async function validateBaseVersion(
  serviceName,
  baseVersionArgs,
  helper,
  logger,
  exceptionHelper,
  functionName,
) {
  try {
    assert(
      !isNaN(baseVersionArgs) &&
        parseFloat(baseVersionArgs) === Math.round(parseFloat(baseVersionArgs)) &&
        parseFloat(baseVersionArgs) > 0,
      `BaseVersion must be a Integer, and 0 < baseVersion`,
    );
  } catch (e) {
    await exceptionHelper.throwAndNotifyError(e.message);
  }

  const response = await helper.listVersion(serviceName, 1, baseVersionArgs);

  if (response == undefined || response.body == undefined) {
    await exceptionHelper.throwAndNotifyError(
      `No response found when list versions of service: [${serviceName}]. Please contact staff.`,
    );
  }
  if (
    response.body.versions.length === 0 ||
    response.body.versions[0].versionId !== baseVersionArgs
  ) {
    await exceptionHelper.throwAndNotifyError(
      `BaseVersion: [${baseVersionArgs}] doesn't exists in service: [${serviceName}]. There are two solutions: 1. Do not set baseVersion. Please check README.md for information about not configuring baseVersion. 2. Set a valid baseVersion.`,
    );
  }

  // if function is not in specific version of service, it should reject and let user change the yaml.
  if (!(await helper.isFunctionExistedInBaseVersion(functionName, baseVersionArgs, serviceName))) {
    await exceptionHelper.throwAndNotifyError(
      `Function: [${functionName}] doesn't exist in service: [${serviceName}] of version [${baseVersionArgs}]. There are two solutions: 1. Do not set a baseVersion in the yaml and retry to have a full release. 2. Set a valid baseVersion that contains the function [${functionName}] and retry. `,
    );
  }
}

function checkNotificationPlans(args) {
  let plans = [];
  const argsKeys = Object.keys(args);
  if (argsKeys.includes('notification')) {
    const notifyObject = _.get(args, 'notification');
    for (const object of notifyObject) {
      if (object.dingTalkRobot != undefined) {
        plans.push({ type: 'dingTalkRobot', config: object.dingTalkRobot });
      }
    }
  }
  return plans;
}

module.exports = {
  validateParams,
  parseCanaryPolicy,
  validateBaseVersion,
  isNoVersionInProject,
  checkNotificationPlans,
};

