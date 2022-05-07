function canaryPlansHelper(
  getAliasResponse,
  functionHelper,
  argService,
  baseVersion,
  description,
  canaryVersion,
  aliasName,
  triggers,
  functionName,
  strategyList,
  customDomainList,
) {
  let plan = {
    typeName: 'canaryPlans',
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

  for (const strategy of strategyList) {
    plan.jobs.push({ weight: strategy.weight / 100, interval: strategy.interval });
  }
  plan.jobs.push({ weight: 1 });

  // alias
  plan.isAliasExisted = getAliasResponse != undefined;
  return plan;
}

module.exports = {
  canaryPlansHelper,
};
