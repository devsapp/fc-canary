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

  logger.log(
    `Successfully do the first part of canaryStep, baseVersion: ${baseVersion}, canaryVersion: ${newCreatedVersion}. Weight: ${grayWeight * 100} % to canaryVersion`,
  );

  if (grayWeight === 1) {
    logger.log('Already fully release, stop.');
    return;
  }
  logger.log(`Waiting for fully release.`);

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  await sleep(60000 * interval);

  logger.log(`Begin fully release.`);

  await functionHelper.updateAlias(
    argService,
    baseVersion,
    aliasName,
    description,
    newCreatedVersion,
    1,
  );
}

module.exports = {
  canaryStepHelper,
};
