const _ = require('lodash');

/**
 * except for checking args and inputs,
 * this function also check canary policy and parse it into variable policy and return
 * @param logger
 * @param serviceName
 * @param functionName
 * @param inputs
 * @param args
 * @param fcHelper
 * @returns {Promise<*>}
 */
async function validateParams(
  logger,
  serviceName,
  functionName,
  inputs,
  args,
  fcHelper,
) {


  if (serviceName == undefined) {
    throw new Error(`Missing service name in inputs.`);

  }
  if (functionName == undefined) {
    throw new Error(`Missing function name in inputs.`);

  }

  await validateArgs(inputs, args, logger, fcHelper);

  // check user's custom_domain.
  const {custom_domain: customDomainList = []} = inputs.output && inputs.output.url;
  if (customDomainList.constructor.name !== 'Array') {
    throw new Error(`Failed to parse custom domains.`);

  }
}

function checkCanaryPolicy(args, logger) {
  // check user's canary strategy.
  const policy = parseCanaryPolicy(args, logger);
  if (_.isEmpty(policy)) {
    throw new Error(`Failed to parse the canary policy. Please double-check the configuration.`);

  }
  return policy;
}

async function validateArgs(inputs, args, logger, fcHelper) {
  const {service, baseVersion} = args;
  let baseVersionArgs = baseVersion;
  if (baseVersionArgs != undefined) {
    baseVersionArgs = baseVersionArgs.toString();
  }
  // check whether service in the plugin args is equal to the service deployed.
  let curService;
  if (service != undefined) {
    const serviceDeployed =
      inputs && inputs.props && inputs.props.service && inputs.props.service.name;
    if (serviceDeployed !== service) {
      throw new Error(
        `The service names in args [${service}] and inputs [${serviceDeployed}] are different.`,
      );
    }
    curService = service;
  } else {
    curService = _.get(inputs, 'props.service.name');
  }

  if (baseVersionArgs != undefined) {
    await validateBaseVersion(curService, baseVersionArgs, fcHelper, logger);
  }
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
    if (args.baseVersion !== null) {
      logger.warn(`No canary policy found, the system will perform a full release.`);
    }

    response.key = 'full';
    response.value = 100;
  } else if (policies.length > 1) {
    throw new Error(
      `Only one canary policy can be selected, but [${policies.length}] canary policies are found.`,
    );
  } else {
    // begin validate the strategy
    const canaryPolicyName = policies[0];
    // only canaryPlans input is an array.
    logger.info(`Canary Policy: [${canaryPolicyName}].`);

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
        if (plan.weight == undefined) {
          throw new Error(`Missing weight in canaryPlans' configuration.`);
        }
        if (Math.round(plan.weight) !== plan.weight) {
          logger.debug(`Round weight: ${Math.round(plan.weight)}.`);
          throw new Error(`Weight must be number, current weight: [${plan.weight}].`);
        }
        if (plan.interval == undefined) {
          throw new Error(`Missing interval in canaryPlans' configuration.`);
        } else {
          if (isNaN(plan.interval)) {
            throw new Error(`Interval must be number. Wrong value: [${plan.interval}].`);
          } else {
            if (Math.round(plan.interval) !== plan.interval) {
              throw new Error(`Interval must be Integer. Wrong value: [${plan.interval}].`);
            } else {
              if (plan.interval < 1) {
                throw new Error(`Interval must be equal to or larger than 1: [${plan.interval}].`);
              }
            }
          }
        }

        if (plan.weight > 100) {
          throw new Error(
            `Weight must be less than or equal to 100. Wrong value: [${plan.weight}].`,
          );
        }
        if (plan.weight < 1) {
          throw new Error(`Weight must be equal to or more than 1. Wrong value: [${plan.weight}].`);
        }
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

      if (canaryPolicy.weight == undefined) {
        throw new Error(`Missing weight in [${canaryPolicyName}]'s configuration.`);
      }
      if (Math.round(canaryPolicy.weight) !== canaryPolicy.weight) {
        logger.debug(`Round weight: ${Math.round(canaryPolicy.weight)}.`);
        throw new Error(`Weight must be number, current weight: [${canaryPolicy.weight}].`);
      }
      if (canaryPolicy.weight > 100) {
        throw new Error(
          `Weight must be less than or equal to 100. Wrong value: [${canaryPolicy.weight}]`,
        );
      }
      if (canaryPolicy.weight < 1) {
        throw new Error(
          `Weight must be equal to or more than 1. Wrong value: [${canaryPolicy.weight}].`,
        );
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
        if (isNaN(canaryPolicy.interval)) {
          throw new Error(`Interval must be number. Wrong value: [${canaryPolicy.interval}].`);
        } else {
          if (Math.round(canaryPolicy.interval) !== canaryPolicy.interval) {
            throw new Error(`Interval must be Integer. Wrong value: [${canaryPolicy.interval}].`);
          } else {
            if (canaryPolicy.interval < 1) {
              throw new Error(
                `Interval must be equal to or larger than 1: [${canaryPolicy.interval}]`,
              );
            }
          }
        }
      }

      response.key = `${canaryPolicyName}`;
      response.value = _.get(args, `${canaryPolicyName}`);
    }

    // canaryWeight
    if (canaryPolicyName === 'canaryWeight') {
      const canaryWeight = _.get(args, 'canaryWeight');
      if (canaryWeight == undefined) {
        throw new Error(`Missing weight in [${canaryPolicyName}]'s configuration.`);
      }
      if (Math.round(canaryWeight) !== canaryWeight) {
        logger.debug(`Round weight: ${Math.round(canaryWeight)}.`);
        throw new Error(`Weight must be number, current weight: [${canaryWeight}].`);
      }

      if (canaryWeight > 100) {
        throw new Error(`Weight must be less than or equal to 100. Wrong value: [${canaryWeight}]`);
      }
      if (canaryWeight < 1) {
        throw new Error(`Weight must be equal to or more than 1. Wrong value: [${canaryWeight}].`);
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
 * @returns {Promise<void>}
 */
async function validateBaseVersion(serviceName, baseVersionArgs, helper, logger) {
  if (isNaN(baseVersionArgs)) {
    throw new Error(
      `BaseVersion must be a number, baseVersion: [${baseVersionArgs}], typeof current baseVersion: [${typeof baseVersionArgs}]`,
    );
  }

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

module.exports = { validateParams, checkCanaryPolicy };
