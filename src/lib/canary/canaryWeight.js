function canaryWeightHelper(
  getAliasResponse,
  functionHelper,
  argService,
  baseVersion,
  description,
  canaryVersion,
  aliasName,
  triggers,
  functionName,
  canaryWeight,
  customDomainList,
) {
  let plan = {
    typeName: 'canaryWeight',
    customDomainList,
    service: argService,
    functionName,
    triggers,
    alias: aliasName,
    canaryVersion,
    description,
    baseVersion,
    jobs: [{ weight: canaryWeight / 100 }],
  };
  // alias
  plan.isAliasExisted = getAliasResponse != undefined;
  return plan;
}

module.exports = {
  canaryWeightHelper,
};
