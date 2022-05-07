const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

class CanaryWorker {
  constructor(logger, plan, functionHelper) {
    this.logger = logger;
    this.plan = plan;
    this.functionHelper = functionHelper;
    console.error(plan);
  }

  async doJobs() {
    const {
      typeName,
      customDomainList,
      service,
      functionName,
      triggers,
      jobs,
      alias,
      isAliasExisted,
      baseVersion,
      canaryVersion,
      description,
    } = this.plan;

    for (const [index, job] of jobs.entries()) {
      if (index === 0) {
        if (isAliasExisted) {
          await this.functionHelper.updateAlias(
            service,
            baseVersion,
            alias,
            description,
            canaryVersion,
            job.weight,
          );
        } else {
          await this.functionHelper.createAlias(
            service,
            baseVersion,
            alias,
            description,
            canaryVersion,
            job.weight,
          );
        }
        await this.functionHelper.updateTriggerListByAlias(triggers, functionName, alias, service);
        await this.functionHelper.updateCustomDomainListByAlias(
          service,
          customDomainList,
          alias,
          functionName,
        );
      } else {
        // update alias
        await this.functionHelper.updateAlias(
          service,
          baseVersion,
          alias,
          description,
          canaryVersion,
          job.weight,
        );
      }
      if (typeName === 'full') {
        this.logger.info(`Successfully allocated 100% traffic to baseVersion: [${baseVersion}].`);
        this.logger.info(`Full release completed.`);
        return;
      } else {
        // last term, no need to sleep.
        if (index === jobs.length - 1) {
          this.logger.info(
            `Successfully completed last step of the ${typeName} release: allocated ${
              100 - Math.round(job.weight * 100)
            }% traffic to baseVersion: [${baseVersion}], ${Math.round(
              job.weight * 100,
            )}% traffic to canaryVersion: [${canaryVersion}].`,
          );
          return;
        }
        this.logger.info(
          `Successfully completed one step of the ${typeName} release: allocated ${
            100 - Math.round(job.weight * 100)
          }% traffic to baseVersion: [${baseVersion}], ${Math.round(
            job.weight * 100,
          )}% traffic to canaryVersion: [${canaryVersion}].`,
        );
        await sleep(Math.round(job.interval * 60000));
      }
    }
  }
}

module.exports = { CanaryWorker: CanaryWorker };
