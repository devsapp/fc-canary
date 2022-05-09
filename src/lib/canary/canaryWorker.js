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
        this.notificationHelper.notify(
          `Successfully allocated 100% traffic to baseVersion: [${baseVersion}], service: [${service}], alias: [${alias}].`,
        );
        this.logger.info(`Successfully allocated 100% traffic to baseVersion: [${baseVersion}].`);
        this.logger.info(`Full release completed.`);
        return;
      } else {
        // last term, no need to sleep.
        if (index === jobs.length - 1) {
          this.notificationHelper.notify(
            `Successfully completed last step of the ${typeName} release: allocated ${
              100 - Math.round(job.weight * 100)
            }% traffic to baseVersion: [${baseVersion}], ${Math.round(
              job.weight * 100,
            )}% traffic to canaryVersion: [${canaryVersion}], service: [${service}], alias: [${alias}].`,
          );

          this.logger.info(
            `Successfully completed last step of the ${typeName} release: allocated ${
              100 - Math.round(job.weight * 100)
            }% traffic to baseVersion: [${baseVersion}], ${Math.round(
              job.weight * 100,
            )}% traffic to canaryVersion: [${canaryVersion}].`,
          );
          return;
        }

        this.notificationHelper.notify(
          `Successfully completed one step of the ${typeName} release: allocated ${
            100 - Math.round(job.weight * 100)
          }% traffic to baseVersion: [${baseVersion}], ${Math.round(
            job.weight * 100,
          )}% traffic to canaryVersion: [${canaryVersion}], service: [${service}], alias: [${alias}].`,
        );
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
