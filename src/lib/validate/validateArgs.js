const _ = require('lodash');
const assert = require('assert');

/**
 *
 * @param logger
 * @param params
 * @returns {Promise<void>}
 */
async function validateParams(logger, params) {
  if (params.serviceName == undefined) {
    throw new Error(`Missing service name in inputs.`);
  }
  if (params.functionName == undefined) {
    throw new Error(`Missing function name in inputs.`);
  }
  // check user's custom_domain.
  if (params.customDomainList.constructor.name !== 'Array') {
    throw new Error(`Failed to parse custom domains.`);
  }
}

/**
 * check if there is no version in the project.
 * @param functionHelper
 * @param service
 * @returns {Promise<boolean>}
 */
async function isNoVersionInProject (functionHelper, service) {

  const response = await functionHelper.listVersion(service, undefined, undefined);
  if (
    response == undefined ||
    response.body == undefined ||
    response.body.versions == undefined ||
    typeof response.body.versions[Symbol.iterator] !== 'function'
  ) {
    throw new Error('Listing versions error, please contact the staff.');
  }
  return response.body.versions.length === 0;
}

/**
 * Canary policy, only one of the following parameters can be selected, if not specified then no canary policy
 * @param args
 * @param logger
 * @returns {{}}
 */
function parseCanaryPolicy(args, logger) {
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

    throw new Error(
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
        throw new Error(
          `Format error, missing configuration of plan in canaryPlans, please check the configuration.`,
        );
      }

      for (const plan of _.get(args, 'canaryPlans')) {
        logger.debug(`plan: ${JSON.stringify(plan, null, 2)}.`);
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
      }
      response.key = 'canaryPlans';
      response.value = _.get(args, 'canaryPlans');
    }

    // linearStep and canaryStep
    if (canaryPolicyName === 'linearStep' || canaryPolicyName === 'canaryStep') {
      const canaryPolicy = _.get(args, canaryPolicyName);
      if (canaryPolicy == undefined) {
        throw new Error(
          `Format error, missing configuration in [${canaryPolicyName}], please check the configuration.`,
        );
      }

      assert(
        canaryPolicy.weight &&
          _.isNumber(canaryPolicy.weight) &&
          Math.round(canaryPolicy.weight) === canaryPolicy.weight &&
          canaryPolicy.weight >= 1 &&
          canaryPolicy.weight <= 100,
        `Weight must be set as an integer, and 1 <= weight <= 100. `,
      );

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
        assert(
          _.isNumber(canaryPolicy.interval) &&
            Math.round(canaryPolicy.interval) === canaryPolicy.interval &&
            canaryPolicy.interval >= 1,
          `Interval must be set as an integer, and 1 <= interval. `,
        );
      }
      response.key = `${canaryPolicyName}`;
      response.value = canaryPolicy;
    }

    // canaryWeight
    if (canaryPolicyName === 'canaryWeight') {
      const canaryWeight = _.get(args, 'canaryWeight');

      assert(
        canaryWeight &&
          _.isNumber(canaryWeight) &&
          Math.round(canaryWeight) === canaryWeight &&
          canaryWeight >= 1 &&
          canaryWeight <= 100,
        `Weight must be set as an integer, and 1 <= weight <= 100. `,
      );

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
 * @returns {Promise<void>}
 */
async function validateBaseVersion(serviceName, baseVersionArgs, helper, logger) {
  assert(
    !isNaN(baseVersionArgs) &&
      parseFloat(baseVersionArgs) === Math.round(parseFloat(baseVersionArgs)) &&
      parseFloat(baseVersionArgs) > 0,
    `BaseVersion must be a Integer, and 0 < baseVersion`,
  );

  const response = await helper.listVersion(serviceName, 1, baseVersionArgs);

  if (response == undefined || response.body == undefined) {
    throw new Error(
      `No response found when list versions of service: [${serviceName}]. Please contact staff.`,
    );
  }
  if (
    response.body.versions.length === 0 ||
    response.body.versions[0].versionId !== baseVersionArgs
  ) {
    throw new Error(
      `BaseVersion: [${baseVersionArgs}] doesn't exists in service: [${serviceName}]. There are two solutions: 1. Do not set baseVersion. Please check README.md for information about not configuring baseVersion. 2. Set a valid baseVersion.`,
    );
  }
}

module.exports = { validateParams, parseCanaryPolicy, validateBaseVersion, isNoVersionInProject };
