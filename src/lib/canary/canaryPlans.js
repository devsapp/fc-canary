async function canaryPlansHelper(
  getAliasResponse,
  functionHelper,
  argService,
  baseVersion,
  description,
  newCreatedVersion,
  aliasName,
  triggers,
  functionName,
  strategyList,
  customDomainList,
  logger,
) {
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  for (const [index, strategy] of strategyList.entries()) {
    if (index === 0) {
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
        `Successfully completed one step of the canaryPlans release: allocated ${
          100 - Math.round(canaryWeight * 100)
        }% traffic to baseVersion: [${baseVersion}], ${Math.round(
          canaryWeight * 100,
        )}% traffic to canaryVersion: [${newCreatedVersion}].`,
      );
      await sleep(60000 * interval);
    } else {
      const canaryWeight = strategy.weight / 100;
      const interval = strategy.interval;

      await functionHelper.updateAlias(
        argService,
        baseVersion,
        aliasName,
        description,
        newCreatedVersion,
        canaryWeight,
      );
      logger.info(
        `Successfully completed one step of the canaryPlans release: allocated ${
          100 - Math.round(canaryWeight * 100)
        }% traffic to baseVersion: [${baseVersion}], ${Math.round(
          canaryWeight * 100,
        )}% traffic to canaryVersion: [${newCreatedVersion}].`,
      );
      await sleep(60000 * interval);
    }
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
    `Successfully completed the last step of the canaryPlans release: allocated 100% traffic to canaryVersion: [${newCreatedVersion}].`,
  );
  logger.info(`CanaryPlan release completed.`);
}

module.exports = {
  canaryPlansHelper,
};
