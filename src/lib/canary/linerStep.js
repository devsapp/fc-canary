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
  if (getAliasResponse == undefined) {
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
    `Successfully completed one step of the linearStep release: allocated ${
      100 - Math.round(weightCount * 100)
    }% traffic to baseVersion: [${baseVersion}], ${Math.round(
      weightCount * 100,
    )}% traffic to canaryVersion: [${newCreatedVersion}].`,
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
      `Successfully completed one step of the linearStep release: allocated ${
        100 - Math.round(weightCount * 100)
      }% traffic to baseVersion: [${baseVersion}], ${Math.round(
        weightCount * 100,
      )}% traffic to canaryVersion: [${newCreatedVersion}].`,
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

  logger.info(
    `Successfully completed the last step of the linearStep release: allocated 100% traffic to canaryVersion: [${newCreatedVersion}].`,
  );
  logger.info(`LinearStep release completed.`);
}

module.exports = {
  linerStepHelper,
};
