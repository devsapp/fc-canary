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
async function validateAllParamsAndParseCanaryPolicy(
  logger,
  serviceName,
  functionName,
  inputs,
  args,
  fcHelper,
) {
  let policy;
  await logger.task('Checking', [
    {
      title: 'Checking inputs',
      id: 'inputs',
      task: async () => {
        if (serviceName == undefined) {
          logger.error(`Missing service name in inputs`);
          process.exit(1);
        }
        if (functionName == undefined) {
          logger.error(`Missing function name in inputs`);
          process.exit(1);
        }
      },
    },
    {
      title: 'Checking args',
      id: 'args',
      task: async () => {
        await validateArgs(inputs, args, logger, fcHelper);
      },
    },
    {
      title: 'Checking canary policy',
      id: 'canary policy',
      task: async () => {
        // check user's canary strategy.
        policy = validateCanaryPolicy(args, logger);
        if (_.isEmpty(policy)) {
          this.logger.error(
            `Failed to parse the canary policy. Please double-check the configuration.`,
          );
          process.exit(1);
        }
      },
    },
    {
      title: 'Checking custom domains',
      id: 'custom domains',
      task: async () => {
        // check user's custom_domain.
        const { custom_domain: customDomainList = [] } = inputs.output && inputs.output.url;
        if (customDomainList.constructor.name !== 'Array') {
          logger.error(`Failed to parse custom domains.`);
          process.exit(1);
        }
        await sleep(50);
      },
    },
  ]);
  return policy;
}

async function validateArgs(inputs, args, logger, fcHelper) {
  const { service, baseVersion } = args;
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
      logger.error(
        `The service names in args [${service}] and inputs [${serviceDeployed}] are not the same.`,
      );
      process.exit(1);
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
function validateCanaryPolicy(args, logger) {
  let response = {};
  const argsKeys = Object.keys(args);
  logger.debug(`keys in args: [${argsKeys}]`);

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
  logger.debug(`User input canary policy: ${JSON.stringify(policies)}`);

  if (policies.length === 0) {
    if (args.baseVersion !== null) {
      logger.warn(`No canary policy found, the system will perform a full release`);
    }

    response.key = 'full';
    response.value = 100;
  } else if (policies.length > 1) {
    logger.error(
      `Only one canary policy can be selected, but [${policies.length}] canary policies are found.`,
    );
    process.exit(1);
  } else {
    // begin validate the strategy
    const canaryPolicyName = policies[0];
    // only canaryPlans input is an array.
    logger.info(`Canary Policy: [${canaryPolicyName}].`);

    if (canaryPolicyName === 'canaryPlans') {
      // each plan in canaryPlans can't have a weight > 100
      const plans = _.get(args, 'canaryPlans');
      logger.debug(`canaryPlans: [${plans}]`);

      if (plans === undefined) {
        logger.error(
          `Format error, missing configuration of plan in canaryPlans, please check the configuration.`,
        );
        process.exit(1);
      }

      for (const plan of _.get(args, 'canaryPlans')) {
        logger.debug(`plan: ${JSON.stringify(plan, null, 2)}`);
        if (plan.weight === undefined) {
          logger.error(`Missing weight in canaryPlans' configuration.`);
          process.exit(1);
        }
        if (Math.round(plan.weight) !== plan.weight) {
          logger.debug(`Round weight: ${Math.round(plan.weight)}`);
          logger.error(`Weight must be number, current weight: [${plan.weight}]`);
          process.exit(1);
        }
        if (plan.interval === undefined) {
          logger.error(`Missing interval in canaryPlans' configuration.`);
          process.exit(1);
        } else {
          if (isNaN(plan.interval)) {
            logger.error(`Interval must be number. Wrong value: [${plan.interval}]`);
            process.exit(1);
          } else {
            if (Math.round(plan.interval) !== plan.interval) {
              logger.error(`Interval must be Integer. Wrong value: [${plan.interval}]`);
              process.exit(1);
            } else {
              if (plan.interval < 1) {
                logger.error(`Interval must be equal to or larger than 1: [${plan.interval}]`);
                process.exit(1);
              }
            }
          }
        }

        if (plan.weight > 100) {
          logger.error(`Weight must be less than or equal to 100. Wrong value: [${plan.weight}]`);
          process.exit(1);
        }
        if (plan.weight < 1) {
          logger.error(`Weight must be more than 0. Wrong value: [${plan.weight}]`);
          process.exit(1);
        }
      }
      response.key = 'canaryPlans';
      response.value = _.get(args, 'canaryPlans');
    }

    // linearStep and canaryStep
    if (canaryPolicyName === 'linearStep' || canaryPolicyName === 'canaryStep') {
      const canaryPolicy = _.get(args, canaryPolicyName);
      if (canaryPolicy === undefined) {
        logger.error(
          `Format error, missing configuration in [${canaryPolicyName}], please check the configuration.`,
        );
        process.exit(1);
      }

      if (canaryPolicy.weight === undefined) {
        logger.error(`Missing weight in [${canaryPolicyName}]'s configuration.`);
        process.exit(1);
      }
      if (Math.round(canaryPolicy.weight) !== canaryPolicy.weight) {
        logger.debug(`Round weight: ${Math.round(canaryPolicy.weight)}`);
        logger.error(`Weight must be number, current weight: [${canaryPolicy.weight}]`);
        process.exit(1);
      }
      if (canaryPolicy.weight > 100) {
        logger.error(
          `Weight must be less than or equal to 100. Wrong value: [${canaryPolicy.weight}]`,
        );
        process.exit(1);
      }
      if (canaryPolicy.weight < 1) {
        logger.error(`Weight must be more than 0. Wrong value: [${canaryPolicy.weight}]`);
        process.exit(1);
      }
      if (canaryPolicy.interval == undefined) {
        if (canaryPolicyName === 'linearStep') {
          canaryPolicy.interval = 1;
        }
        if (canaryPolicyName === 'canaryStep') {
          canaryPolicy.interval = 10;
        }
      } else {
        if (isNaN(canaryPolicy.interval)) {
          logger.error(`Interval must be number. Wrong value: [${canaryPolicy.interval}]`);
          process.exit(1);
        } else {
          if (Math.round(canaryPolicy.interval) !== canaryPolicy.interval) {
            logger.error(`Interval must be Integer. Wrong value: [${canaryPolicy.interval}]`);
            process.exit(1);
          } else {
            if (canaryPolicy.interval < 1) {
              logger.error(
                `Interval must be equal to or larger than 1: [${canaryPolicy.interval}]`,
              );
              process.exit(1);
            }
          }
        }
      }

      response.key = `${canaryPolicyName}`;
      response.value = _.get(args, `[${canaryPolicyName}]`);
    }

    // canaryWeight
    if (canaryPolicyName === 'canaryWeight') {
      const canaryWeight = _.get(args, 'canaryWeight');
      if (canaryWeight === undefined) {
        logger.error(`Missing weight in [${canaryPolicyName}]'s configuration.`);
        process.exit(1);
      }
      if (Math.round(canaryWeight) !== canaryWeight) {
        logger.debug(`Round weight: ${Math.round(canaryWeight)}`);
        logger.error(`Weight must be number, current weight: [${canaryWeight}]`);
        process.exit(1);
      }

      if (canaryWeight > 100) {
        logger.error(
          `Weight must be less than or equal to 100. Wrong value: [${canaryWeight}]`,
        );
        process.exit(1);
      }
      if (canaryWeight < 1) {
        logger.error(`Weight must be more than 0. Wrong value: [${canaryWeight}]`);
        process.exit(1);
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
    logger.error(
      `BaseVersion must be a number, baseVersion: [${baseVersionArgs}], typeof current baseVersion: [${typeof baseVersionArgs}]`,
    );
    process.exit(1);
  }

  const response = await helper.listVersion(serviceName, 1, baseVersionArgs);

  if (response == undefined || response.body == undefined) {
    logger.error(
      `No response found when list versions of service: [${serviceName}]. Please contact staff.`,
    );
    process.exit(1);
  }

  if (
    response.body.versions.length === 0 ||
    response.body.versions[0].versionId !== baseVersionArgs
  ) {
    logger.error(`BaseVersion: [${baseVersionArgs}] doesn't exists in service: [${serviceName}]. There are two solutions: 1. Do not set baseVersion。 Please check readme.md for information about not configuring baseVersion. 2. Set a valid baseVersion.`);
    process.exit(1);
  }

}

function sleep(timer) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), timer);
  });
}

module.exports = { validateAllParamsAndParseCanaryPolicy };
