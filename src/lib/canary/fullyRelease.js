function fullyReleaseHelper(
  getAliasResponse,
  functionHelper,
  argService,
  description,
  canaryVersion,
  aliasName,
  triggers,
  functionName,
  customDomainList,
) {
  let plan = {
    typeName: 'full',
    customDomainList,
    service: argService,
    functionName,
    triggers,
    alias: aliasName,
    description,
    jobs: [{ weight: 1 }],
  };
  // alias
  if (getAliasResponse == undefined) {
    plan.isAliasExisted = false;
    // new created version will be the baseVersion.
    plan.baseVersion = canaryVersion;
  } else {
    plan.isAliasExisted = true;
    // new created version will be the baseVersion.
    plan.baseVersion = canaryVersion;
  }
  return plan;
}

module.exports = {
  fullyReleaseHelper,
};
