async function canaryStepHelper(
  getAliasResponse,
  functionHelper,
  argService,
  baseVersion,
  description,
  newCreatedVersion,
  aliasName,
  triggers,
  functionName,
  strategy,
  customDomainList,
  logger,
) {
  const canaryWeight = strategy.weight / 100;
  const interval = strategy.interval;

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
    `Successfully preform the first part of canaryStep, baseVersion: [${baseVersion}], canaryVersion: [${newCreatedVersion}]. ${100 - Math.round(canaryWeight * 100)}% traffic to baseVersion, ${Math.round(canaryWeight * 100)}% traffic to canaryVersion.`,
  );

  if (canaryWeight === 1) {
    logger.info('Already preform a full release, stop.');
    return;
  }

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  await sleep(60000 * interval);


  await functionHelper.updateAlias(
    argService,
    baseVersion,
    aliasName,
    description,
    newCreatedVersion,
    1,
  );

  logger.info( `Successfully preform the full release, baseVersion: [${baseVersion}], canaryVersion:[${newCreatedVersion}] 100% to canaryVersion.`);
}

module.exports = {
  canaryStepHelper,
};
