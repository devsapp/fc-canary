async function fullyReleaseHelper(
  getAliasResponse,
  functionHelper,
  argService,
  description,
  newCreatedVersion,
  aliasName,
  triggers,
  functionName,
  customDomainList,
  logger,
) {
  // alias
  if (getAliasResponse == undefined) {
    await functionHelper.createAlias(
      argService,
      newCreatedVersion,
      aliasName,
      description,
      null,
      1,
    );
  } else {
    await functionHelper.updateAlias(
      argService,
      newCreatedVersion,
      aliasName,
      description,
      null,
      1,
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

  logger.info(`Successfully allocated 100% traffic to canaryVersion: [${newCreatedVersion}].`);
  logger.info(`Full release completed.`);
}

module.exports = {
  fullyReleaseHelper,
};
