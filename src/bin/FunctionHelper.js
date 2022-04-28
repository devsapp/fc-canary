const _ = require('lodash');
const { CreateAliasRequest, UpdateAliasRequest } = require('@alicloud/fc-open20210406');

class FunctionHelper {
  constructor(helper, logger) {
    this.helper = helper;
    this.logger = logger;
  }

  /**
   *
   * @param serviceName
   * @param description
   * @returns {Promise<*>}
   */
  async publishVersion(serviceName, description) {
    this.logger.info(`Begin to publish version, serviceName: ${serviceName}`);
    const response = await this.helper.publishVersion(serviceName, description);
    if (
      response !== undefined &&
      response.body !== undefined &&
      response.body.versionId !== undefined &&
      !isNaN(response.body.versionId)
    ) {
      return parseInt(response.body.versionId);
    }
    throw new Error(
      `Publish version response doesn't include versionId, please contact the staff. ServiceName: ${serviceName}` +
        ` description: ${description}, Publish version response: ${JSON.stringify(
          response,
          null,
          2,
        )}`,
    );
  }

  /**
   * find the baseVersion
   *   a. baseVersion === null
   *     - if alias exists, set the version of the alias to baseVersion
   *     - if alias doesn't exist, set the previous version of new created alias version to baseVersion
   *        - if the previous version doesn't exist, fully release the alias and warning.
   * @param baseVersion
   * @param aliasName
   * @param serviceName
   * @param newCreatedVersion
   * @returns {Promise<*>}
   */
  // todo list 有问题
  async findBaseVersion(baseVersion, aliasName, serviceName, newCreatedVersion) {
    if (baseVersion === null) {
      // if alias is valid, let current alise version to be baseVersion.
      const getAliasResponse = await this.getAlias(serviceName, aliasName);

      // if aliasName exists, set the version of the aliasName to baseVersion
      if (getAliasResponse !== undefined) {
        if (isNaN(getAliasResponse.body.versionId)) {
          throw new Error(
            `VersionId in getAliasResponse is not a number. AliasName: ${aliasName}, ServiceName: ${serviceName}, ` +
              `getAliasResponse: ${JSON.stringify(getAliasResponse, null, 2)}`,
          );
        }
        baseVersion = getAliasResponse.body.versionId;
      } else {
        const getVersionResponse = await this.helper.listVersion(
          serviceName,
          2,
          newCreatedVersion.toString(),
        );

        if (
          getVersionResponse === undefined ||
          getVersionResponse.body === undefined ||
          getVersionResponse.body.versions === undefined ||
          getVersionResponse.body.versions.constructor.name !== 'Array'
        ) {
          throw new Error(
            `Response from listVersion is undefined, serviceName: ${serviceName}, newCreatedVersion: ${newCreatedVersion}. please contact the staff`,
          );
        }

        const versionIdList = getVersionResponse.body.versions;
        if (
          versionIdList.length === 0 ||
          versionIdList[0].versionId !== newCreatedVersion.toString()
        ) {
          throw new Error(`New created version: ${newCreatedVersion} has been deleted.`);
        } else {
          if (versionIdList.length === 1) {
            throw new Error(`New created version is the oldest version, can't find a baseVersion`);
          } else {
            baseVersion = versionIdList[1].versionId;
          }
        }
      }
    } else {
      baseVersion = baseVersion.toString();
    }

    // after argsValidate, if baseVersion is not undefined, it must be a valid version.
    return baseVersion;
  }

  async createAlias(serviceName, baseVersion, aliasName, description, newCreatedVersion, weight) {
    if (baseVersion === undefined || baseVersion === null) {
      throw new Error('To create an alias, you must specify the baseVersion.');
    }
    let request;

    // if newCreatedVersion === undefined, it means it is fully release.
    if (newCreatedVersion == undefined) {
      request = new CreateAliasRequest({
        aliasName: aliasName,
        description: description,
        versionId: baseVersion.toString(),
      });
    } else {
      request = new CreateAliasRequest({
        aliasName: aliasName,
        description: description,
        versionId: baseVersion.toString(),
        additionalVersionWeight: { [newCreatedVersion]: weight },
      });
    }

    this.logger.log(`Begin to create a new Alias. AliasName: ${aliasName}`);
    const createAliasResponse = await this.helper.createAlias(serviceName, request);
    if (createAliasResponse === undefined || createAliasResponse.body === undefined) {
      throw new Error(
        `System error in creating alias, please contact the staff, service: ${serviceName}, alias: ${aliasName}`,
      );
    }
    if (createAliasResponse.body.aliasName !== aliasName) {
      throw new Error(
        `Create alias Error, response alias name: ${createAliasResponse.body.aliasName}, expected alias name: ${aliasName}`,
      );
    }
  }

  async updateAlias(serviceName, baseVersion, aliasName, description, newCreatedVersion, weight) {
    let request;
    if (baseVersion == undefined) {
      // if there is no baseVersionId, fully release.
      request = new UpdateAliasRequest({
        description: description,
        additionalVersionWeight: { [newCreatedVersion]: weight },
      });
    } else {
      if (newCreatedVersion == undefined) {
        request = new UpdateAliasRequest({
          versionId: baseVersion.toString(),
          description: description,
        });
      } else {
        request = new UpdateAliasRequest({
          versionId: baseVersion.toString(),
          description: description,
          additionalVersionWeight: { [newCreatedVersion]: weight },
        });
      }
    }
    this.logger.log(`Begin to update a Alias. AliasName: ${aliasName}`);
    const updateAliasResponse = await this.helper.updateAlias(serviceName, aliasName, request);
    if (updateAliasResponse === undefined || updateAliasResponse.body === undefined) {
      throw new Error(
        `System error in updating alias, please contact the staff, service: ${serviceName}, alias: ${aliasName}`,
      );
    }
    if (updateAliasResponse.body.aliasName !== aliasName) {
      throw new Error(
        `Create alias Error, response alias name: ${updateAliasResponse.body.aliasName}, expected alias name: ${aliasName}`,
      );
    }
  }

  async getAlias(serviceName, aliasName) {
    this.logger.log(`Begin to get an Alias. AliasName: ${aliasName}`);
    let getAliasResponse;
    try {
      getAliasResponse = await this.helper.getAlias(serviceName, aliasName);
      if (
        getAliasResponse === undefined ||
        getAliasResponse.body === undefined ||
        getAliasResponse.body.versionId === undefined
      ) {
        throw new Error(
          `Response is undefined when finding alias,` +
            ` serviceName: ${serviceName}, aliasName: ${aliasName}, please contact staff.`,
        );
      }
    } catch (e) {
      // if Alias not found, the system will throw an error.
      if (e.message.indexOf('AliasNotFound') !== -1) {
        this.logger.log(
          `Alias ${aliasName} doesn't exist, we will create alias ${aliasName}, service: ${serviceName}`,
        );
      } else {
        throw e;
      }
    }
    return getAliasResponse;
  }

  async updateTriggerListByAlias(triggers, functionName, aliasName, serviceName) {
    this.logger.log(
      `Begin to update triggers, serviceName: ${serviceName}, functionName: ${functionName}, aliasName: ${aliasName}`,
    );
    for (const item of triggers) {
      const response = await this.helper.updateTriggerAlias(
        serviceName,
        functionName,
        item.name,
        aliasName,
      );
      if (
        response === undefined ||
        response.body === undefined ||
        response.body.qualifier !== aliasName
      ) {
        throw new Error(
          `Update trigger with new alias failed.` +
            ` triggerName: ${item.triggerName}, functionName: ${item.functionName}, ` +
            `serviceName: ${serviceName}, alias name: ${aliasName}`,
        );
      }
    }
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
    this.logger.log(`Begin to update the custom domains of service ${serviceName}`);
    if (customDomainList.constructor.name !== 'Array') {
      throw new Error(
        `Parameter CustomDomainList is not a array, ` +
          `type of customDomainList: ${customDomainList.constructor.name} ` +
          `customDomainList: ${customDomainList}`,
      );
    }
    for (const item of customDomainList) {
      if (item.domain === undefined) {
        throw new Error('custom domain name is undefined. Please check the custom domain configs');
      }
      const regex = /^https?\:\/\//i;
      const domainName = item.domain.replace(regex, '');
      this.logger.log(`Begin to update custom domain: ${domainName}`);
      const response = await this.helper.getCustomDomain(domainName);
      if (response === undefined || response.body === undefined) {
        throw new Error(
          `System error in getting a customDomain, please contact the staff, custom domain name: ${domainName}`,
        );
      }
      const routes = response.body.routeConfig.routes;
      for (const route of routes) {
        if (route.serviceName === serviceName && route.functionName === functionName) {
          route.qualifier = aliasName;
        }
      }
      const updateCustomDomainResponse = await this.helper.updateCustomDomain(domainName, routes);
      if (
        updateCustomDomainResponse === undefined ||
        updateCustomDomainResponse.body === undefined ||
        updateCustomDomainResponse.body.routeConfig === undefined ||
        updateCustomDomainResponse.body.routeConfig.routes === undefined
      ) {
        throw new Error(`Update custom domain error, custom domain name: ${domainName}`);
      }
      // check if update successfully.
      const routesResponse = updateCustomDomainResponse.body.routeConfig.routes;
      if (
        _.isEmpty(routesResponse) !== _.isEmpty(routes) &&
        routes.length !== routesResponse.length
      ) {
        throw new Error(
          `Update custom domain error, the number of updated domains is not equal to the number of domains required to be updated. ` +
            `routes updated: ${routesResponse.length}, routes required to be updated: ${routes.length}`,
        );
      }
      for (const route of routesResponse) {
        if (route.qualifier !== aliasName) {
          throw new Error(
            `Update custom domain error, the qualifier (also called alias) is not updated`,
          );
        }
      }
    }
  }
}

module.exports = { FunctionHelper: FunctionHelper };
