const Client = require('@alicloud/fc-open20210406').default;
const {
  ListServiceVersionsRequest,
  PublishServiceVersionRequest,
  UpdateTriggerRequest,
  UpdateCustomDomainRequest,
} = require('@alicloud/fc-open20210406');


class FcHelper {
  constructor(config, logger) {
    this.logger = logger;
    this.client = new Client(config);
  }

  /**
   * retry 是为了保证在系统抛出ECONNRESET 异常时重试并完成创建、更新资源。
   *
   * @param fnName
   * @param args
   * @returns {Promise<*>}
   */
  async retry(fnName, ...args) {
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.client[fnName](...args);
      } catch (e) {
        if (e.code === 'ECONNRESET') {
          this.logger.debug('An ECONNRESET exception occurred, using the retry strategy to fix the exception.');

        } else if (e.message.indexOf('AliasNotFound') !== -1) {
          throw e;
        } else {
          this.logger.error(e);
          process.exit(1);
        }
      }
    }
  }

  async listVersion(serviceName, Limit, startKey) {
    const request = new ListServiceVersionsRequest({ limit: Limit, startKey: startKey });
    try {
      this.logger.debug(`Begin to list the versions of service: [${serviceName}].`);
      const response = await this.retry('listServiceVersions', serviceName, request);

      this.logger.debug(`ListVersion response: ${JSON.stringify(response, null, 2)}`);

      return response;
    } catch (e) {
      this.logger.error(e);
      process.exit(1);
    }
  }

  async publishVersion(serviceName, description) {
    const request = new PublishServiceVersionRequest({ description });
    try {
      this.logger.debug(
        `Publish version request: ${JSON.stringify(request, null, 2)}, service: ${serviceName} `,
      );
      const response = await this.retry('publishServiceVersion', serviceName, request);
      this.logger.debug(`Publish version response: ${JSON.stringify(response, null, 2)}`);
      return response;
    } catch (e) {

      this.logger.error(e);
      process.exit(1);
    }
  }

  async createAlias(serviceName, request) {
    this.logger.debug(`Create alias request: ${JSON.stringify(request, null, 2)}`);

    const response = await this.retry('createAlias', serviceName, request);
    this.logger.debug(`Create alias response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async getAlias(serviceName, aliasName) {
    this.logger.debug(`Get alias request, serviceName: [${serviceName}], aliasName: [${aliasName}]`);
    let response;
    try {
      response =  await this.retry('getAlias', serviceName, aliasName);
    } catch (e) {

      throw e;
    }
    this.logger.debug(`Get alias response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async updateAlias(serviceName, aliasName, request) {
    this.logger.debug(`Update alias request: ${JSON.stringify(request, null, 2)}`);

    const response = await this.retry('updateAlias', serviceName, aliasName, request);
    this.logger.debug(`Update alias response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async updateTriggerAlias(serviceName, functionName, triggerName, aliasName) {
    const request = new UpdateTriggerRequest({ qualifier: aliasName });
    this.logger.debug(
      `Update Trigger Alias: serviceName: [${serviceName}],` +
      ` functionName: [${functionName}], triggerName: [${triggerName}],` +
      ` aliasName: [${aliasName}], request: ${JSON.stringify(request, null, 2)}`,
    );
    const response = await this.retry(
      'updateTrigger',
      serviceName,
      functionName,
      triggerName,
      request,
    );
    this.logger.debug(`Update trigger response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async getCustomDomain(domain) {
    this.logger.debug(`Get custom domain: [${domain}]`);
    let response;
    try {
      response = await this.retry('getCustomDomain', domain);
    } catch (e) {
      if (e.message.includes('DomainNameNotFound')) {
        this.logger.error(`Failed to check custom domain: [${domain}], domain not found.`);
        process.exit(1);
      }
    }
    this.logger.debug(`Get custom domain response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async updateCustomDomain(domainName, routes) {
    const request = new UpdateCustomDomainRequest({ routeConfig: { routes: routes } });
    this.logger.debug(
      `Update custom domain request: ${JSON.stringify(
        request,
        null,
        2,
      )}, domainName: [${domainName}]`,
    );
    const response = await this.retry('updateCustomDomain', domainName, request);
    this.logger.debug(`Update custom domain response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }
}


module.exports = {FcHelper: FcHelper};
