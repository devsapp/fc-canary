

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
  canaryWeight,
  customDomainList,
  logger,
) {
  // alias
  if (getAliasResponse == undefined) {
    await functionHelper.createAlias(
      argService,
      baseVersion,
      aliasName,
      description,
      newCreatedVersion,
      canaryWeight,
    );
  } else {
    await functionHelper.updateAlias(
      argService,
      baseVersion,
      aliasName,
      description,
      newCreatedVersion,
      canaryWeight,
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

  logger.info(
    `Successfully completed the canaryWeight release: ${
      100 - Math.round(canaryWeight * 100)
    }% traffic to baseVersion: [${baseVersion}], ${Math.round(
      canaryWeight * 100,
    )}% traffic to new created version: [${newCreatedVersion}].`,
  );
  logger.info(`CanaryWeight release completed.`);
}

module.exports = {
  canaryWeightHelper,
};
