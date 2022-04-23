const Client = require("@alicloud/fc-open20210406").default;
const {
  ListServiceVersionsRequest, PublishServiceVersionRequest,CreateAliasRequest, UpdateTriggerRequest, UpdateCustomDomainRequest
} = require("@alicloud/fc-open20210406");


class FcHelper {
  constructor(config, args, inputs, logger) {
    this.logger = logger
    this.client = new Client(config);
  }


  async listVersion(serviceName) {
    const request = new ListServiceVersionsRequest();
    try {
      const response = await this.client.listServiceVersions(serviceName, request);
      this.logger.log(`listVersion response: ${JSON.stringify(response, null, 2)}`);

      return response;
    } catch (e) {
      this.logger.Error(e);
    }
  }

  async publishVersion(serviceName, description) {
    const request = new PublishServiceVersionRequest({description});
    try {
      this.logger.log(`publish version request: ${JSON.stringify(request, null, 2)}, service: ${serviceName} `);
      const response = await this.client.publishServiceVersion(serviceName, request);
      this.logger.log(`publish version response: ${response}`);
    } catch (e) {
      this.logger.log(e)
    }

  }

  async createAlias(serviceName, baseVersionId, aliasName, description, aliasVersionId, weight) {

    let request;
    if (baseVersionId === null) {
      // if there is no baseVersionId, fully release.
      request = new CreateAliasRequest({
        aliasName: aliasName,
        description: description,
        additionalVersionWeight: {aliasVersionId: weight}
      })
    } else {
      request = new CreateAliasRequest({
        aliasName: aliasName,
        description: description,
        versionId: baseVersionId,
        additionalVersionWeight: {aliasVersionId: weight}
      })
    }

    this.logger.log(`Create alias request: ${JSON.stringify(request, null, 2)}`);

    const response = this.client.createAlias(serviceName, request);
    this.logger.log(`Create alias response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async getAlias(serviceName, aliasName) {

    this.logger.log(`Get alias serviceName: ${serviceName}, aliasName: ${aliasName}`);
    const response = await this.client.getAlias(serviceName, aliasName);
    this.logger.log(`Get alias response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async updateTriggerAlias(serviceName, functionName, triggerName, aliasName) {
    const request = new UpdateTriggerRequest({qualifier: aliasName});
    this.logger.log(`Update Trigger Alias: serviceName: ${serviceName},`+
      ` functionName: ${functionName}, triggerName: ${triggerName},`+
        ` aliasName: ${aliasName}, request: ${JSON.stringify(request, null, 2)}`);
    const response = await this.client.updateTrigger()
    this.logger.log(`Update trigger response: ${JSON.stringify(response, null, 2)}`);

  }

  async updateTriggerListByAlias(triggers, aliasName, serviceName) {
    for (const item of triggers) {
      await this.updateTriggerAlias(serviceName, item.functionName, item.triggerName, aliasName);
    }
  }
  async getCustomDomain(domain) {
    this.logger.log(`Get custom domain: ${domain}`);
    const response = await new this.client.getCustomDomain(domain);
    this.logger.log(`Get custom domain response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }

  async updateCustomDomain(domainName, routes) {
    const request = new UpdateCustomDomainRequest({routeConfig: {routes: routes}});
    this.logger.log(`Update custom domain request: ${JSON.stringify(request, null, 2)}`);
    const response = await this.client.updateCustomDomain(domainName, request);
    this.logger.log(`Update custom domain response: ${JSON.stringify(response, null, 2)}`);
    return response;
  }


}


module.exports = {FcHelper: FcHelper};
