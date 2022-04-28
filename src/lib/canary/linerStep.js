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
  const grayWeight = strategy.weight / 100;
  const interval = strategy.interval;

  let weightCount = grayWeight;

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

  logger.log(
    `Successfully do the part of linearStep, baseVersion: ${baseVersion}, canaryVersion: ${newCreatedVersion}. Weight: ${
      weightCount * 100
    }% to canaryVersion`,
  );

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  await sleep(60000 * interval);
  weightCount = weightCount + grayWeight;
  while (weightCount < 1) {
    await functionHelper.updateAlias(
      argService,
      baseVersion,
      aliasName,
      description,
      newCreatedVersion,
      weightCount,
    );
    logger.log(
      `Successfully do the part of linearStep, baseVersion: ${baseVersion}, canaryVersion: ${newCreatedVersion}. Weight: ${
        weightCount * 100
      }% to canaryVersion`,
    );
    weightCount = weightCount + grayWeight;
    await sleep(60000 * interval);
  }

  logger.log(`Begin fully release.`);

  await functionHelper.updateAlias(
    argService,
    baseVersion,
    aliasName,
    description,
    newCreatedVersion,
    1,
  );

  logger.log(`Fully release successfully.`);
}

module.exports = {
  linerStepHelper,
};
