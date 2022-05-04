

async function canaryWeightHelper(
  getAliasResponse,
  functionHelper,
  argService,
  baseVersion,
  description,
  newCreatedVersion,
  aliasName,
  triggers,
  functionName,
  grayWeight,
  customDomainList,
  logger,
) {
  // alias
  if (getAliasResponse === undefined) {
    await functionHelper.createAlias(
      argService,
      baseVersion,
      aliasName,
      description,
      newCreatedVersion,
      grayWeight,
    );
  } else {
    await functionHelper.updateAlias(
      argService,
      baseVersion,
      aliasName,
      description,
      newCreatedVersion,
      grayWeight,
    );
  }

  // trigger
  await functionHelper.updateTriggerListByAlias(triggers, functionName, aliasName, argService);

  // custom domain:
  await functionHelper.updateCustomDomainListByAlias(
    argService,
    customDomainList,
    aliasName,
    functionName,
  );

  logger.info(`Successfully do canaryWeight release, ${100 - Math.round(grayWeight * 100)}% traffic to baseVersion: [${baseVersion}], ${Math.round(grayWeight * 100)}% traffic to new created version: [${newCreatedVersion}].`);
}

module.exports = {
  canaryWeightHelper,
};
