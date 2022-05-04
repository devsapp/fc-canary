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
  const grayWeight = strategy.weight / 100;
  const interval = strategy.interval;

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

  logger.info(
    `Successfully preform the first part of canaryStep, baseVersion: [${baseVersion}], canaryVersion: [${newCreatedVersion}]. Weight: ${Math.round(grayWeight * 100)} % to canaryVersion`,
  );

  if (grayWeight === 1) {
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

  logger.info( `Successfully preform the full release, baseVersion: [${baseVersion}], canaryVersion:[${newCreatedVersion}] 100% to canaryVersion`,);
}

module.exports = {
  canaryStepHelper,
};
