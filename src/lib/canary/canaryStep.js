function canaryStepHelper(
  getAliasResponse,
  functionHelper,
  argService,
  baseVersion,
  description,
  canaryVersion,
  aliasName,
  triggers,
  functionName,
  strategy,
  customDomainList,
) {
  const canaryWeight = strategy.weight / 100;
  const interval = strategy.interval;

  let plan = {
    typeName: 'canaryStep',
    customDomainList,
    service: argService,
    functionName,
    triggers,
    alias: aliasName,
    canaryVersion,
    description,
    baseVersion,

  };

  if (canaryWeight === 1) {
    plan.jobs= [{ weight: 1}];
  } else {
    plan.jobs= [{ weight: canaryWeight, interval: interval}, {weight: 1}];
  }
  // alias
  plan.isAliasExisted = getAliasResponse != undefined;
  return plan;





  // if (canaryWeight === 1) {
  //   logger.info(`Already allocated 100% traffic to canaryVersion: [${canaryVersion}], stop.`);
  //   logger.info(`CanaryStep release completed.`);
  //   return;
  // }

  // const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  //
  // await sleep(60000 * interval);
  //
  // await functionHelper.updateAlias(
  //   argService,
  //   baseVersion,
  //   aliasName,
  //   description,
  //   canaryVersion,
  //   1,
  // );

  // logger.info(
  //   `Successfully completed the second step of the canaryStep release: allocated 100% traffic to canaryVersion: [${canaryVersion}].`,
  // );
  // logger.info(`CanaryStep release completed.`);
}

module.exports = {
  canaryStepHelper,
};
