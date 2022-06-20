const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

class CanaryWorker {
  constructor(logger, plans, functionHelper, notificationHelper) {
    this.logger = logger;
    this.plans = plans;
    this.functionHelper = functionHelper;
    this.notificationHelper = notificationHelper;
  }

  async doJobs() {
    const {
      typeName, // 'full', 'canaryStep', 'canaryPlans'...
      customDomainList,
      service,
      functionName,
      triggers,
      jobs, // jobs should be finished.
      alias,
      isAliasExisted, // if alias exists, update alias, on the contrary, create a new alias
      baseVersion,
      canaryVersion,
      description,
    } = this.plans;

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
        if (triggers != undefined && triggers.length != 0) {
          await this.functionHelper.updateTriggerListByAlias(triggers, functionName, alias, service);
        }
        if (customDomainList != undefined && customDomainList.length != 0) {
          await this.functionHelper.updateCustomDomainListByAlias(
            service,
            customDomainList,
            alias,
            functionName,
          );
        }
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
       await this.notificationHelper.notify(
          `Successfully completed the release: allocated 100% traffic to baseVersion: [${baseVersion}], service: [${service}], alias: [${alias}], canary policy: full release.`,
        );
        this.logger.info(
          `Successfully completed the release: allocated 100% traffic to baseVersion: [${baseVersion}], service: [${service}], alias: [${alias}], canary policy: full release.`,
        );
        this.logger.info(`Full release completed.`);
        return;
      } else {
        // last term, no need to sleep.
        if (index === jobs.length - 1) {
         await this.notificationHelper.notify(
            `Successfully completed the last step of the release: allocated ${
              100 - Math.round(job.weight * 100)
            }% traffic to baseVersion: [${baseVersion}], ${Math.round(
              job.weight * 100,
            )}% traffic to canaryVersion: [${canaryVersion}], service: [${service}], alias: [${alias}], canary policy:  ${typeName} release.`,
          );

          this.logger.info(
            `Successfully completed the last step of the release: allocated ${
              100 - Math.round(job.weight * 100)
            }% traffic to baseVersion: [${baseVersion}], ${Math.round(
              job.weight * 100,
            )}% traffic to canaryVersion: [${canaryVersion}], service: [${service}], alias: [${alias}], canary policy:  ${typeName} release.`,
          );
          return;
        }

       await this.notificationHelper.notify(
          `Successfully completed one step of the release: allocated ${
            100 - Math.round(job.weight * 100)
          }% traffic to baseVersion: [${baseVersion}], ${Math.round(
            job.weight * 100,
          )}% traffic to canaryVersion: [${canaryVersion}], service: [${service}], alias: [${alias}], canary policy: ${typeName} release.`,
        );
        this.logger.info(
          `Successfully completed one step of the release: allocated ${
            100 - Math.round(job.weight * 100)
          }% traffic to baseVersion: [${baseVersion}], ${Math.round(
            job.weight * 100,
          )}% traffic to canaryVersion: [${canaryVersion}], service: [${service}], alias: [${alias}], canary policy: ${typeName} release.`,
        );
        await sleep(Math.round(job.interval * 60000));
      }
    }
  }
}

module.exports = { CanaryWorker: CanaryWorker };
