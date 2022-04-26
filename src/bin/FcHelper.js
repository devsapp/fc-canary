const Client = require('@alicloud/fc-open20210406').default;
const {
  ListServiceVersionsRequest,
  PublishServiceVersionRequest,
  CreateAliasRequest,
  UpdateTriggerRequest,
  UpdateCustomDomainRequest,
  UpdateAliasRequest,
} = require('@alicloud/fc-open20210406');


class FcHelper {
  constructor(config, logger) {
    this.logger = logger;
    this.client = new Client(config);
  }

  async listVersion(serviceName) {
    const request = new ListServiceVersionsRequest();
    try {
      const response = await this.client.listServiceVersions(serviceName, request);
      this.logger.log(`listVersion response: ${JSON.stringify(response, null, 2)}`);

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
      const response = await this.client.publishServiceVersion(serviceName, request);
      this.logger.log(`Publish version response: ${JSON.stringify(response, null, 2)}`);
      return response;
    } catch (e) {
      throw new Error(e);
    }
  }

  async createAlias(serviceName, baseVersion, aliasName, description, newCreatedVersion, weight) {
    let request;
    if (baseVersion === null) {
      // if there is no baseVersionId, fully release.
      request = new CreateAliasRequest({
        aliasName: aliasName,
        description: description,
        additionalVersionWeight: { [newCreatedVersion]: weight }
      });
    } else {
      request = new CreateAliasRequest({
        aliasName: aliasName,
        description: description,
        versionId: baseVersion,
        additionalVersionWeight: { [newCreatedVersion]: weight },
      });
    }

    this.logger.log(`Create alias request: ${JSON.stringify(request, null, 2)}`);

    const response = await this.client.createAlias(serviceName, request);
    this.logger.log(`Create alias response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async getAlias(serviceName, aliasName) {
    this.logger.log(`Get alias serviceName: ${serviceName}, aliasName: ${aliasName}`);
    const response = await this.client.getAlias(serviceName, aliasName);
    this.logger.log(`Get alias response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async updateAlias(serviceName, baseVersion, aliasName, description, newCreatedVersion, weight) {
    let request;
    if (baseVersion === null) {
      // if there is no baseVersionId, fully release.
      request = new UpdateAliasRequest({
        description: description,
        additionalVersionWeight: {[newCreatedVersion]: weight}
      });
    } else {
      request = new UpdateAliasRequest({
        versionId: baseVersion,
        description: description,
        additionalVersionWeight: {[newCreatedVersion]: weight}
      });
    }

    this.logger.log(`Update alias request: ${JSON.stringify(request, null, 2)}`);

    const response = await this.client.updateAlias(serviceName, aliasName, request);
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
    const response = await this.client.updateTrigger(
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
    const response = await this.client.getCustomDomain(domain);
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
    const response = await this.client.updateCustomDomain(domainName, request);
    this.logger.log(`Update custom domain response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }
}


module.exports = {FcHelper: FcHelper};
