const _ = require('lodash');

async function validateArgs(inputs, args, logger, fcHelper) {
  const { service, baseVersion } = args;

  // check whether service in the plugin args is equal to the service deployed.
  let curService;
  if (service != undefined) {
    const serviceDeployed =
      inputs && inputs.props && inputs.props.service && inputs.props.service.name;
    if (serviceDeployed !== service) {
      throw new Error(
        `The plugin's service is unequal to service deployed. ` +
          `Name of service in the plugin: ${service}` +
          ` Name of service deployed: ${serviceDeployed}`,
      );
    }
    curService = service;
  } else {
    curService = _.get(inputs, 'props.service.name');
    logger.log(`Current serviceName: ${curService}`);
  }

  if (baseVersion != undefined) {
    await validateBaseVersion(curService, baseVersion, fcHelper, logger);
  }
}

/**
 * Grayscale Strategy, only one of the following parameters can be selected, if not specified then no grayscale
 * @param args
 * @param logger
 * @returns {{}}
 */
function validateCanaryStrategy(args, logger) {
  let response = {};
  const argsKeys = Object.keys(args);
  logger.log(`keys in args: ${argsKeys}`);

  let grayList = [];
  if (argsKeys.includes('canaryStep')) {
    grayList.push('canaryStep');
  }
  if (argsKeys.includes('canaryWeight')) {
    grayList.push('canaryWeight');
  }
  if (argsKeys.includes('canaryPlans')) {
    grayList.push('canaryPlans');
  }
  if (argsKeys.includes('linearStep')) {
    grayList.push('linearStep');
  }
  logger.debug(`User input canary policy: ${JSON.stringify(grayList)}`);

  if (grayList.length === 0) {
    if (args.baseVersion !== null) {
      logger.warn(
        `We found that you didn't select the canary policy, so it defaults to a full release. With a full release, even if baseVersion is set, the codes will still be released at the newly created version.`,
      );
    }

    response.key = 'full';
    response.value = 100;
  } else if (grayList.length > 1) {
    throw new Error(
      `Choose at most one grayscale strategy! You chose ${grayList.length} strategies`,
    );
  } else {
    // begin validate the strategy
    const grayStrategyName = grayList[0];
    // only canaryPlans input is an array.
    logger.log(grayStrategyName);

    if (grayStrategyName === 'canaryPlans') {
      // each plan in canaryPlans can't have a weight > 100
      const plans = _.get(args, 'canaryPlans');
      logger.log(`canaryPlans: ${plans}`);

      if (plans === undefined) {
        throw new Error(
          `CanaryPlans' format error, please double check the canaryPlans in the yaml.`,
        );
      }

      for (const plan of _.get(args, 'canaryPlans')) {
        logger.log(`plan: ${JSON.stringify(plan, null, 2)}`);
        if (plan.weight === undefined) {
          throw new Error(`Weight is required`);
        }
        if (plan.interval === undefined) {
          throw new Error(`Interval is required`);
        }

        if (plan.weight > 100) {
          throw new Error(`Plans in canaryPlans can't have a weight > 100`);
        }
        if (plan.weight < 1) {
          throw new Error(`Plans in canaryPlans can't have a weight <= 0`);
        }
      }
      response.key = 'canaryPlans';
      response.value = _.get(args, 'canaryPlans');
    }

    // linearStep and canaryStep
    if (grayStrategyName === 'linearStep' || grayStrategyName === 'canaryStep') {
      const grayStrategy = _.get(args, grayStrategyName);
      if (grayStrategy === undefined) {
        throw new Error(
          `${grayStrategyName}'s format error, please double check the ${grayStrategyName} in the yaml.`,
        );
      }

      if (grayStrategy.weight === undefined) {
        throw new Error(`Weight is required, grayscale strategy: ${grayStrategyName}`);
      }
      if (grayStrategy.weight > 100) {
        throw new Error(
          `Grayscale strategy: ${grayStrategyName} can't have a weight > 100, current weight: ${grayStrategy.weight}`,
        );
      }
      if (grayStrategy.weight < 1) {
        throw new Error(
          `Grayscale strategy: ${grayStrategyName} can't have a weight <= 0, current weight: ${grayStrategy.weight}`,
        );
      }
      response.key = `${grayStrategyName}`;
      response.value = _.get(args, `${grayStrategyName}`);
    }

    // canaryWeight
    if (grayStrategyName === 'canaryWeight') {
      const canaryWeight = _.get(args, 'canaryWeight');
      if (canaryWeight === undefined) {
        throw new Error(
          `CanaryWeight's format error, please double check the canaryWeight in the yaml.`,
        );
      }

      if (canaryWeight > 100) {
        throw new Error(`canaryWeight can't have a weight > 100, current weight: ${canaryWeight}`);
      }
      if (canaryWeight < 1) {
        throw new Error(`canaryWeight can't have a weight <= 0, current weight: ${canaryWeight}`);
      }

      response.key = 'canaryWeight';
      response.value = _.get(args, 'canaryWeight');
    }
  }
  return response;
}

/**
 * check whether baseVersion must exist online.
 * @param serviceName
 * @param baseVersion
 * @param helper
 * @param logger
 * @returns {Promise<void>}
 */
async function validateBaseVersion(serviceName, baseVersion, helper, logger) {
  if (isNaN(baseVersion)) {
    throw new Error(
      `BaseVersion is not number, baseVersion: ${baseVersion}, typeof baseVersion: ${typeof baseVersion}`,
    );
  }

  const response = await helper.listVersion(serviceName, 1, baseVersion.toString());

  if (response == undefined || response.body == undefined) {
    throw new Error(
      `No response from the system when validate versions, serviceName: ${serviceName}, please contact staff.`,
    );
  }

  if (
    response.body.versions.length != 1 ||
    response.body.versions[0].versionId !== baseVersion.toString()
  ) {
    throw new Error(
      `BaseVersion is not valid. baseVersion: ${baseVersion}, serviceName: ${serviceName}`,
    );
  }
}


module.exports = { validateArgs, validateCanaryStrategy };
