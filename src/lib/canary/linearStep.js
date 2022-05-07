function linearStepHelper(
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
  customDomainList
) {
  const canaryWeight = strategy.weight / 100;
  const interval = strategy.interval;



  let plan = {
    typeName: 'linearStep',
    customDomainList,
    service: argService,
    functionName,
    triggers,
    alias: aliasName,
    canaryVersion,
    description,
    baseVersion,
  };

  plan.jobs = [];
  let weightCount = canaryWeight;
  if (weightCount === 1) {
    plan.jobs = [{ weight: 1 }];
  } else {
    while (weightCount < 1) {
      plan.jobs.push({ weight: weightCount, interval: interval });
      weightCount = weightCount + canaryWeight;
    }
    plan.jobs.push({ weight: 1 });
  }
  // alias
  plan.isAliasExisted = getAliasResponse != undefined;
  return plan;
}

module.exports = {
  linearStepHelper,
};
