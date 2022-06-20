const _ = require('lodash');
const {
  CreateAliasRequest,
  UpdateAliasRequest,
  PublishServiceVersionRequest,
  ListServiceVersionsRequest,
  UpdateTriggerRequest,
  UpdateCustomDomainRequest, GetFunctionRequest,
} = require('@alicloud/fc-open20210406');
const Client = require('@alicloud/fc-open20210406').default;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

class FunctionHelper {
  constructor(logger, config, exceptionHelper) {
    this.logger = logger;
    this.client = new Client(config);
    this.exceptionHelper = exceptionHelper;
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
          this.logger.debug(
            'An ECONNRESET exception occurred, using the retry strategy to fix the exception.',
          );
          await sleep(80);
        } else {
          throw new Error(e);
        }
      }
    }
  }

  /**
   *
   * @param serviceName
   * @param description
   * @returns {Promise<*>}
   */
  async publishVersion(serviceName, description) {
    let response;
    try {
      const request = new PublishServiceVersionRequest({ description });
      this.logger.debug(
        `Publish version request: ${JSON.stringify(request, null, 2)}, service: ${serviceName} `,
      );
      response = await this.retry('publishServiceVersion', serviceName, request);
      this.logger.debug(`Publish version response: ${JSON.stringify(response, null, 2)}.`);
    } catch (e) {
      await this.exceptionHelper.throwAndNotifyError(
        `Error code: [${e.code}], error message: [${e.message}]`,
      );
    }

    if (
      response == undefined ||
      response.body == undefined ||
      response.body.versionId == undefined
    ) {
      await this.exceptionHelper.throwAndNotifyError(
        `No response found when publish new version of service: [${serviceName}]. Please contact staff.`,
      );
    }
    if (!isNaN(response.body.versionId)) {
      return response.body.versionId;
    }
    await this.exceptionHelper.throwAndNotifyError(
      `Failed to create a new version of service: [${serviceName}], please contact the staff.`,
    );
  }

  /**
   * find the baseVersion
   *   a. baseVersion === null
   *     - if alias exists, set the version of the alias to baseVersion
   *     - if alias doesn't exist, set the previous version of new created alias version to baseVersion
   *        - if the previous version doesn't exist, fully release the alias and warning.
   * @param baseVersionArgs
   * @param aliasName
   * @param serviceName
   * @param canaryVersion
   * @param getAliasResponse
   * @returns {Promise<*>}
   */
  async findBaseVersion(baseVersionArgs, aliasName, serviceName, canaryVersion, getAliasResponse) {
    let baseVersion = baseVersionArgs;
    if (baseVersionArgs == undefined) {
      // if aliasName exists, set the version of the aliasName to baseVersion
      if (getAliasResponse !== undefined && getAliasResponse.body != undefined) {
        if (isNaN(getAliasResponse.body.versionId)) {
          await this.exceptionHelper.throwAndNotifyError(
            `VersionId of alias: [${aliasName}] is not a number. Please contact staff.`,
          );
        }
        baseVersion = getAliasResponse.body.versionId;
      } else {
        let getVersionResponse = await this.listVersion(serviceName, 2, canaryVersion);

        if (
          getVersionResponse == undefined ||
          getVersionResponse.body == undefined ||
          getVersionResponse.body.versions == undefined ||
          getVersionResponse.body.versions.constructor.name != 'Array'
        ) {
          await this.exceptionHelper.throwAndNotifyError(
            `No response found when list versions of service: [${serviceName}]. Please contact staff.`,
          );
        }

        const versionIdList = getVersionResponse.body.versions;
        if (versionIdList.length === 0 || versionIdList[0].versionId !== canaryVersion) {
          await this.exceptionHelper.throwAndNotifyError(
            `New created version: [${canaryVersion}] has been deleted.`,
          );
        } else if (versionIdList.length === 1) {
          // if there is only new canaryVersion, in parseCanaryPolicy method will catch it and set the policy to full release,
          // there is no way to get here.
          await this.exceptionHelper.throwAndNotifyError(
            `The length of versionList of project is changed during the process.`,
          );
        } else {
          baseVersion = versionIdList[1].versionId;
        }
      }
    }
    this.logger.debug(`After finding baseVersion, current baseVersion is: [${baseVersion}].`);
    // after argsValidate, if baseVersion is not undefined, it must be a valid version.
    return baseVersion;
  }

  async createAlias(serviceName, baseVersion, aliasName, description, canaryVersion, weight) {
    this.logger.debug(`Begin to create a new Alias: [${aliasName}].`);
    if (baseVersion == undefined) {
      await this.exceptionHelper.throwAndNotifyError(
        'BaseVersion must be set when creating a new alias.',
      );
    }
    let request;

    // if canaryVersion == undefined, it means it is a full release.
    if (canaryVersion == undefined) {
      request = new CreateAliasRequest({
        aliasName: aliasName,
        description: description,
        versionId: baseVersion,
      });
    } else {
      request = new CreateAliasRequest({
        aliasName: aliasName,
        description: description,
        versionId: baseVersion,
        additionalVersionWeight: { [canaryVersion]: weight },
      });
    }
    this.logger.debug(`Create alias request: ${JSON.stringify(request, null, 2)}.`);
    let createAliasResponse;
    try {
      createAliasResponse = await this.retry('createAlias', serviceName, request);
      this.logger.debug(`Create alias response: ${JSON.stringify(createAliasResponse, null, 2)}.`);
    } catch (e) {
      await this.exceptionHelper.throwAndNotifyError(
        `Error code: [${e.code}], error message: [${e.message}]`,
      );
    }

    if (createAliasResponse == undefined || createAliasResponse.body == undefined) {
      await this.exceptionHelper.throwAndNotifyError(
        `No response found when creating a new alias: [${aliasName}]. Please contact staff.`,
      );
    }
    if (createAliasResponse.body.aliasName !== aliasName) {
      await this.exceptionHelper.throwAndNotifyError(
        `Failed to create an alias, expect: [${aliasName}], return: [${createAliasResponse.body.aliasName}].`,
      );
    }
    this.logger.info(`Successfully created a new Alias: [${aliasName}].`);
  }

  async updateAlias(serviceName, baseVersion, aliasName, description, canaryVersion, weight) {
    this.logger.debug(`Begin to update a Alias: [${aliasName}].`);
    let request;
    if (baseVersion == undefined) {
      // if there is no baseVersionId, fully release.
      request = new UpdateAliasRequest({
        description: description,
        additionalVersionWeight: { [canaryVersion]: weight },
      });
    } else {
      if (canaryVersion == undefined) {
        request = new UpdateAliasRequest({
          versionId: baseVersion,
          description: description,
        });
      } else {
        request = new UpdateAliasRequest({
          versionId: baseVersion,
          description: description,
          additionalVersionWeight: { [canaryVersion]: weight },
        });
      }
    }
    let updateAliasResponse;
    try {
      this.logger.debug(`Update alias request: ${JSON.stringify(request, null, 2)}.`);
      updateAliasResponse = await this.retry('updateAlias', serviceName, aliasName, request);
      this.logger.debug(`Update alias response: ${JSON.stringify(updateAliasResponse, null, 2)}.`);
    } catch (e) {
      await this.exceptionHelper.throwAndNotifyError(
        `Error code: [${e.code}], error message: [${e.message}]`,
      );
    }
    if (updateAliasResponse == undefined || updateAliasResponse.body == undefined) {
      await this.exceptionHelper.throwAndNotifyError(
        `No response found when updating an alias: [${aliasName}]. Please contact the staff.`,
      );
    }
    if (updateAliasResponse.body.aliasName !== aliasName) {
      await this.exceptionHelper.throwAndNotifyError(
        `Failed to update an alias, expect: [${aliasName}], return: [${updateAliasResponse.body.aliasName}].`,
      );
    }

    this.logger.debug(`Successfully updated alias: [${aliasName}].`);
  }

  async getAlias(serviceName, aliasName) {
    let getAliasResponse;
    try {
      this.logger.debug(
        `Get alias request, serviceName: [${serviceName}], aliasName: [${aliasName}].`,
      );
      getAliasResponse = await this.retry('getAlias', serviceName, aliasName);
      this.logger.debug(`Get alias response: ${JSON.stringify(getAliasResponse, null, 2)}.`);
      if (
        getAliasResponse == undefined ||
        getAliasResponse.body == undefined ||
        getAliasResponse.body.versionId == undefined
      ) {
        await this.exceptionHelper.throwAndNotifyError(
          `No response found when checking alias: [${aliasName}]. Please contact staff.`,
        );
      }
    } catch (e) {
      // if Alias not found, the system will throw an error, we use this to check whether alias exists.
      if (e.message.indexOf('AliasNotFound') !== -1) {
        // do nothing
      } else {
        await this.exceptionHelper.throwAndNotifyError(
          `Error code: [${e.code}], error message: [${e.message}]`,
        );
      }
    }
    return getAliasResponse;
  }

  async updateTriggerListByAlias(triggers, functionName, aliasName, serviceName) {
    this.logger.debug(`Begin to update triggers.`);
    for (const item of triggers) {
      let response;
      try {
        const request = new UpdateTriggerRequest({ qualifier: aliasName });

        this.logger.debug(
          `Update Trigger Alias: serviceName: [${serviceName}],` +
            ` functionName: [${functionName}], triggerName: [${item.name}],` +
            ` aliasName: [${aliasName}], request: ${JSON.stringify(request, null, 2)}`,
        );

        response = await this.retry('updateTrigger', serviceName, functionName, item.name, request);
        this.logger.debug(`Update trigger response: ${JSON.stringify(response, null, 2)}.`);
      } catch (e) {
        await this.exceptionHelper.throwAndNotifyError(
          `Error code: [${e.code}], error message: [${e.message}]`,
        );
      }
      if (
        response == undefined ||
        response.body == undefined ||
        response.body.qualifier !== aliasName
      ) {
        await this.exceptionHelper.throwAndNotifyError(
          `Failed to update trigger: [${item.triggerName}]. Please contact staff.`,
        );
      }
    }
    this.logger.info(`Successfully updated triggers by setting alias: [${aliasName}].`);
  }

  /**
   *
   * @param serviceName
   * @param customDomainList
   *        [
   *        {
   *          "domain": "xxxxxx"
   *        },
   *        {
   *          "domain": "xxxxxx"
   *        }
   *        ]
   * @param aliasName
   * @param functionName
   * @returns {Promise<void>}
   */
  async updateCustomDomainListByAlias(serviceName, customDomainList, aliasName, functionName) {
    this.logger.debug('Begin to update custom domains.');
    for (const item of customDomainList) {
      if (item.domain == undefined) {
        await this.exceptionHelper.throwAndNotifyError(
          `Custom domain name is undefined. Please check the custom domain configuration`,
        );
      }

      const regex = /^https?\:\/\//i;
      const domainName = item.domain.replace(regex, '');
      this.logger.debug(`Get custom domain: [${domainName}].`);
      let response;
      try {
        response = await this.retry('getCustomDomain', domainName);
      } catch (e) {
        await this.exceptionHelper.throwAndNotifyError(
          `Error code: [${e.code}], error message: [${e.message}]`,
        );
      }
      this.logger.debug(`Get custom domain response: ${JSON.stringify(response, null, 2)}.`);

      if (
        response == undefined ||
        response.body == undefined ||
        response.body.routeConfig == undefined
      ) {
        await this.exceptionHelper.throwAndNotifyError(
          `No response found when checking customDomain: [${domainName}]. Please contact staff.`,
        );
      }
      const routes = response.body.routeConfig.routes;

      if (!(Symbol.iterator in routes)) {
        await this.exceptionHelper.throwAndNotifyError(
          `Failed to check custom domain, routes are not iterable: [${domainName}]. Please contact staff.`,
        );
      }
      this.logger.debug(`Successfully checked custom domain: [${domainName}] exists.`);
      for (const route of routes) {
        if (route.serviceName === serviceName && route.functionName === functionName) {
          route.qualifier = aliasName;
        }
      }
      this.logger.debug(`Begin to update custom domain [${domainName}] with alias [${aliasName}]`);

      let updateCustomDomainResponse;
      try {
        const request = new UpdateCustomDomainRequest({ routeConfig: { routes: routes } });
        this.logger.debug(
          `Update custom domain request: ${JSON.stringify(
            request,
            null,
            2,
          )}, domainName: [${domainName}]`,
        );

        updateCustomDomainResponse = await this.retry('updateCustomDomain', domainName, request);
        this.logger.debug(
          `Update custom domain response: ${JSON.stringify(updateCustomDomainResponse, null, 2)}.`,
        );
      } catch (e) {
        await this.exceptionHelper.throwAndNotifyError(
          `Error code: [${e.code}], error message: [${e.message}]`,
        );
      }

      if (
        updateCustomDomainResponse == undefined ||
        updateCustomDomainResponse.body == undefined ||
        updateCustomDomainResponse.body.routeConfig == undefined ||
        updateCustomDomainResponse.body.routeConfig.routes == undefined
      ) {
        await this.exceptionHelper.throwAndNotifyError(
          `No response found when update custom domain: [${domainName}]. Please contact staff.`,
        );
      }
      // check if update successfully.
      const routesResponse = updateCustomDomainResponse.body.routeConfig.routes;
      if (
        _.isEmpty(routesResponse) !== _.isEmpty(routes) &&
        routes.length !== routesResponse.length
      ) {
        await this.exceptionHelper.throwAndNotifyError(
          `Failed to update custom domain, the number of routes before and after the update is different.`,
        );
      }
      for (const route of routesResponse) {
        if (
          route.serviceName === serviceName &&
          route.functionName === functionName &&
          route.qualifier !== aliasName
        ) {
          await this.exceptionHelper.throwAndNotifyError(
            `Failed to update custom domain, the qualifiers of routes were not updated.`,
          );
        }
      }
      this.logger.info(
        `Successfully updated custom domain: [${domainName}] by setting alias: [${aliasName}].`,
      );
    }
    this.logger.debug(`Finish updating custom domains.`);
  }

  async listVersion(serviceName, Limit, startKey) {
    const request = new ListServiceVersionsRequest({ limit: Limit, startKey: startKey });
    try {
      this.logger.debug(`Begin to list the versions of service: [${serviceName}].`);
      const response = await this.retry('listServiceVersions', serviceName, request);

      this.logger.debug(`ListVersion response: ${JSON.stringify(response, null, 2)}.`);

      return response;
    } catch (e) {
      await this.exceptionHelper.throwAndNotifyError(
        `Error code: [${e.code}], error message: [${e.message}]`,
      );
    }
  }

  async isFunctionExistedInBaseVersion(functionName, baseVersion, serviceName) {
    const request = new GetFunctionRequest({qualifier: baseVersion});
    try {
      this.logger.debug(`Begin to check the function [${functionName}] whether it is in service: [${serviceName}] of version [${baseVersion}].`);
      const response = await this.retry('getFunction', serviceName, functionName, request);
      this.logger.debug(`Check function response: ${JSON.stringify(response, null, 2)}.`);
      if ( response == undefined ||
        response.body == undefined ||
        response.body.functionName == undefined ) {
        await this.exceptionHelper.throwAndNotifyError(
          `Failed to check whether function [${functionName}] is in service [${serviceName}] of baseVersion [${baseVersion}]: response received from sdk is none. `,
        );
      }
      if (response.body.functionName == functionName) {
        return true;
      }
      await this.exceptionHelper.throwAndNotifyError(
        `Failed to check whether function [${functionName}] is in service [${serviceName}] of baseVersion [${baseVersion}]: function name is different from that in response. `,
      );
      return false;
    } catch (e) {
      if (e.message.indexOf('FunctionNotFound') !== -1) {
        return false;
      } else {
        await this.exceptionHelper.throwAndNotifyError(
          `Error code: [${e.code}], error message: [${e.message}]`,
        );
      }
    }
  }
}

module.exports = { FunctionHelper: FunctionHelper };
