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
        `Successfully do the part of canaryPlans, baseVersion: ${baseVersion}, canaryVersion: ${newCreatedVersion}. Weight: ${
          grayWeight * 100
        }% to canaryVersion`,
      );
      logger.log(`Waiting for next release.`);
      await sleep(60000 * interval);
    } else {
      const grayWeight = strategy.weight / 100;
      const interval = strategy.interval;

      await functionHelper.updateAlias(
        argService,
        baseVersion,
        aliasName,
        description,
        newCreatedVersion,
        grayWeight,
      );
      logger.log(
        `Successfully do the part of canaryPlans, baseVersion: ${baseVersion}, canaryVersion: ${newCreatedVersion}. Weight: ${
          grayWeight * 100
        }% to canaryVersion`,
      );
      logger.log(`Waiting for next release.`);
      await sleep(60000 * interval);
    }
  }
  logger.log('Begin fully release');
  await functionHelper.updateAlias(
    argService,
    baseVersion,
    aliasName,
    description,
    newCreatedVersion,
    1,
  );
  logger.log(
    `Successfully do the part of canaryPlans, baseVersion: ${baseVersion}, canaryVersion: ${newCreatedVersion}. Weight: 100% to canaryVersion`,
  );
}

module.exports = {
  canaryPlansHelper,
};
