async function fullyReleaseHelper(
  getAliasResponse,
  functionHelper,
  argService,
  description,
  newCreatedVersion,
  aliasName,
  triggers,
  functionName,
  customDomainList,
  logger,
) {
  // alias
  if (getAliasResponse === undefined) {
    await functionHelper.createAlias(
      argService,
      null,
      aliasName,
      description,
      newCreatedVersion,
      1,
    );
  } else {
    await functionHelper.updateAlias(
      argService,
      null,
      aliasName,
      description,
      newCreatedVersion,
      1,
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

  logger.log('Successfully do fully release');
}

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

  logger.log('Successfully do canaryWeight release');
}

module.exports = {
  canaryWeightHelper,
  fullyReleaseHelper,
};
