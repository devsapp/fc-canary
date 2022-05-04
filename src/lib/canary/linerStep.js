async function linerStepHelper(
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

  let weightCount = canaryWeight;

  // alias
  if (getAliasResponse === undefined) {
    await functionHelper.createAlias(
      argService,
      baseVersion,
      aliasName,
      description,
      newCreatedVersion,
      weightCount,
    );
  } else {
    await functionHelper.updateAlias(
      argService,
      baseVersion,
      aliasName,
      description,
      newCreatedVersion,
      weightCount,
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
    `Successfully preform the part of linearStep, baseVersion: [${baseVersion}], canaryVersion: [${newCreatedVersion}]. Weight: ${
      Math.round(weightCount * 100)
    }% to canaryVersion`,
  );

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  await sleep(60000 * interval);
  weightCount = (weightCount * 3 + canaryWeight * 3) / 3;
  while (weightCount < 1) {
    await functionHelper.updateAlias(
      argService,
      baseVersion,
      aliasName,
      description,
      newCreatedVersion,
      weightCount,
    );
    logger.info(
      `Successfully preform the part of linearStep, baseVersion: [${baseVersion}], canaryVersion: [${newCreatedVersion}]. Weight: ${
        Math.round(weightCount * 100)
      }% to canaryVersion`,
    );

    weightCount = (weightCount * 3 + canaryWeight * 3) / 3;
    await sleep(60000 * interval);
  }

  await functionHelper.updateAlias(
    argService,
    baseVersion,
    aliasName,
    description,
    newCreatedVersion,
    1,
  );

  logger.info( `Successfully preform the full release, baseVersion: [${baseVersion}], canaryVersion:[${newCreatedVersion}] 100% to canaryVersion`,);
}

module.exports = {
  linerStepHelper,
};
