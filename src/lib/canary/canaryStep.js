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
}

module.exports = {
  canaryStepHelper,
};
