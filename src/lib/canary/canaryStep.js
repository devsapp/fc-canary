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
    `Successfully completed the first step of the canaryStep release: allocated ${
      100 - Math.round(canaryWeight * 100)
    }% traffic to baseVersion: [${baseVersion}], ${Math.round(
      canaryWeight * 100,
    )}% traffic to canaryVersion: [${newCreatedVersion}].`,
  );

  if (canaryWeight === 1) {
    logger.info(`Already allocated 100% traffic to canaryVersion: [${newCreatedVersion}], stop.`);
    logger.info(`CanaryStep release completed.`);
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

  logger.info(
    `Successfully completed the second step of the canaryStep release: allocated 100% traffic to canaryVersion: [${newCreatedVersion}].`,
  );
  logger.info(`CanaryStep release completed.`);
}

module.exports = {
  canaryStepHelper,
};
