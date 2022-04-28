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
          this.logger.warn('An ECONNRESET exception occurred');

        } else {
          throw new Error(e);
        }
      }
    }
  }

  async listVersion(serviceName, Limit, startKey) {
    const request = new ListServiceVersionsRequest({ limit: Limit, startKey: startKey });
    try {
      this.logger.debug(`Begin to list the versions.`);
      // const response = await this.client.listServiceVersions(serviceName, request);
      const response = await this.retry('listServiceVersions', serviceName, request);

      this.logger.log(`ListVersion response: ${JSON.stringify(response, null, 2)}`);

      return response;
    } catch (e) {
      throw new Error(e);
    }
  }

  async publishVersion(serviceName, description) {
    const request = new PublishServiceVersionRequest({ description });
    try {
      this.logger.log(
        `Publish version request: ${JSON.stringify(request, null, 2)}, service: ${serviceName} `,
      );
      // const response = await this.client.publishServiceVersion(serviceName, request);
      const response = await this.retry('publishServiceVersion', serviceName, request);
      this.logger.log(`Publish version response: ${JSON.stringify(response, null, 2)}`);
      return response;
    } catch (e) {
      throw new Error(e);
    }
  }

  async createAlias(serviceName, request) {
    this.logger.log(`Create alias request: ${JSON.stringify(request, null, 2)}`);

    // const response = await this.client.createAlias(serviceName, request);
    const response = await this.retry('createAlias', serviceName, request);
    this.logger.log(`Create alias response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async getAlias(serviceName, aliasName) {
    this.logger.log(`Get alias serviceName: ${serviceName}, aliasName: ${aliasName}`);
    // const response = await this.client.getAlias(serviceName, aliasName);
    const response = await this.retry('getAlias', serviceName, aliasName);
    this.logger.log(`Get alias response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async updateAlias(serviceName, aliasName, request) {
    this.logger.log(`Update alias request: ${JSON.stringify(request, null, 2)}`);

    // const response = await this.client.updateAlias(serviceName, aliasName, request);
    const response = await this.retry('updateAlias', serviceName, aliasName, request);
    this.logger.log(`Update alias response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async updateTriggerAlias(serviceName, functionName, triggerName, aliasName) {
    const request = new UpdateTriggerRequest({ qualifier: aliasName });
    this.logger.log(
      `Update Trigger Alias: serviceName: ${serviceName},` +
        ` functionName: ${functionName}, triggerName: ${triggerName},` +
        ` aliasName: ${aliasName}, request: ${JSON.stringify(request, null, 2)}`,
    );
    const response = await this.retry(
      'updateTrigger',
      serviceName,
      functionName,
      triggerName,
      request,
    );
    this.logger.log(`Update trigger response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async getCustomDomain(domain) {
    this.logger.log(`Get custom domain: ${domain}`);
    // const response = await this.client.getCustomDomain(domain);
    const response = await this.retry('getCustomDomain', domain);
    this.logger.log(`Get custom domain response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async updateCustomDomain(domainName, routes) {
    const request = new UpdateCustomDomainRequest({ routeConfig: { routes: routes } });
    this.logger.log(
      `Update custom domain request: ${JSON.stringify(
        request,
        null,
        2,
      )}, domainName: ${domainName}`,
    );
    // const response = await this.client.updateCustomDomain(domainName, request);
    const response = await this.retry('updateCustomDomain', domainName, request);
    this.logger.log(`Update custom domain response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }
}


module.exports = {FcHelper: FcHelper};
