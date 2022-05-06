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
    const response = await this.helper.publishVersion(serviceName, description);
    if (
      response == undefined ||
      response.body == undefined ||
      response.body.versionId == undefined
    ) {
      throw new Error(
        `No response found when publish new version of service: [${serviceName}]. Please contact staff.`,
      );
    }
    if (!isNaN(response.body.versionId)) {
      return response.body.versionId;
    }
    throw new Error(
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
   * @param newCreatedVersion
   * @param getAliasResponse
   * @returns {Promise<*>}
   */
  async findBaseVersion(
    baseVersionArgs,
    aliasName,
    serviceName,
    newCreatedVersion,
    getAliasResponse,
  ) {
    let baseVersion = baseVersionArgs;
    if (baseVersionArgs == undefined) {
      // if aliasName exists, set the version of the aliasName to baseVersion
      if (getAliasResponse !== undefined && getAliasResponse.body != undefined) {
        if (isNaN(getAliasResponse.body.versionId)) {
          throw new Error(
            `VersionId of alias: [${aliasName}] is not a number. Please contact staff.`,
          );
        }
        baseVersion = getAliasResponse.body.versionId;
      } else {
        const getVersionResponse = await this.helper.listVersion(serviceName, 2, newCreatedVersion);

        if (
          getVersionResponse == undefined ||
          getVersionResponse.body == undefined ||
          getVersionResponse.body.versions == undefined ||
          getVersionResponse.body.versions.constructor.name != 'Array'
        ) {
          throw new Error(
            `No response found when list versions of service: [${serviceName}]. Please contact staff.`,
          );
        }

        const versionIdList = getVersionResponse.body.versions;
        if (versionIdList.length === 0 || versionIdList[0].versionId !== newCreatedVersion) {
          throw new Error(`New created version: [${newCreatedVersion}] has been deleted.`);
        } else {
          if (versionIdList.length === 1) {
            baseVersion = newCreatedVersion;
          } else {
            baseVersion = versionIdList[1].versionId;
          }
        }
      }
    }
    this.logger.debug(`After finding baseVersion, current baseVersion is: [${baseVersion}].`);
    // after argsValidate, if baseVersion is not undefined, it must be a valid version.
    return baseVersion;
  }

  async createAlias(serviceName, baseVersion, aliasName, description, newCreatedVersion, weight) {
    this.logger.debug(`Begin to create a new Alias: [${aliasName}].`);
    if (baseVersion == undefined) {
      throw new Error('BaseVersion must be set when creating a new alias.');
    }
    let request;

    // if newCreatedVersion == undefined, it means it is a full release.
    if (newCreatedVersion == undefined) {
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
        additionalVersionWeight: { [newCreatedVersion]: weight },
      });
    }
    const createAliasResponse = await this.helper.createAlias(serviceName, request);
    if (createAliasResponse == undefined || createAliasResponse.body == undefined) {
      throw new Error(
        `No response found when creating a new alias: [${aliasName}]. Please contact staff.`,
      );
    }
    if (createAliasResponse.body.aliasName !== aliasName) {
      throw new Error(
        `Failed to create an alias, expect: [${aliasName}], return: [${createAliasResponse.body.aliasName}].`,
      );
    }
    this.logger.info(`Successfully created a new Alias: [${aliasName}].`);
  }

  async updateAlias(serviceName, baseVersion, aliasName, description, newCreatedVersion, weight) {
    this.logger.debug(`Begin to update a Alias: [${aliasName}].`);
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
          versionId: baseVersion,
          description: description,
        });
      } else {
        request = new UpdateAliasRequest({
          versionId: baseVersion,
          description: description,
          additionalVersionWeight: { [newCreatedVersion]: weight },
        });
      }
    }
    const updateAliasResponse = await this.helper.updateAlias(serviceName, aliasName, request);
    if (updateAliasResponse == undefined || updateAliasResponse.body == undefined) {
      throw new Error(
        `No response found when updating an alias: [${aliasName}]. Please contact the staff.`,
      );
    }
    if (updateAliasResponse.body.aliasName !== aliasName) {
      throw new Error(
        `Failed to update an alias, expect: [${aliasName}], return: [${updateAliasResponse.body.aliasName}].`,
      );
    }

    this.logger.debug(`Successfully updated alias: [${aliasName}].`);
  }

  async getAlias(serviceName, aliasName) {
    let getAliasResponse;
    try {
      getAliasResponse = await this.helper.getAlias(serviceName, aliasName);
      if (
        getAliasResponse == undefined ||
        getAliasResponse.body == undefined ||
        getAliasResponse.body.versionId == undefined
      ) {
        throw new Error(
          `No response found when checking alias: [${aliasName}]. Please contact staff.`,
        );
      }
    } catch (e) {
      // if Alias not found, the system will throw an error, we use this to check whether alias exists.
      // warn: 在FcHelper.js retry方法捕获！！！
      if (e.message.indexOf('AliasNotFound') !== -1) {
        // do nothing
      } else {
        throw new Error(
          `System error, error_code: [${e.code}], error_message: [${e.message}], please contact the staff.`,
        );
      }
    }
    return getAliasResponse;
  }

  async updateTriggerListByAlias(triggers, functionName, aliasName, serviceName) {
    this.logger.debug(`Begin to update triggers.`);
    for (const item of triggers) {
      const response = await this.helper.updateTriggerAlias(
        serviceName,
        functionName,
        item.name,
        aliasName,
      );
      if (
        response == undefined ||
        response.body == undefined ||
        response.body.qualifier !== aliasName
      ) {
        throw new Error(`Failed to update trigger: [${item.triggerName}]. Please contact staff.`);
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
        throw new Error(
          `Custom domain name is undefined. Please check the custom domain configuration`,
        );
      }

      const regex = /^https?\:\/\//i;
      const domainName = item.domain.replace(regex, '');
      this.logger.debug(`Begin to check custom domain: [${domainName}].`);
      const response = await this.helper.getCustomDomain(domainName);

      if (
        response == undefined ||
        response.body == undefined ||
        response.body.routeConfig == undefined
      ) {
        throw new Error(
          `No response found when checking customDomain: [${domainName}]. Please contact staff.`,
        );
      }
      const routes = response.body.routeConfig.routes;

      if (!(Symbol.iterator in routes)) {
        throw new Error(
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
      const updateCustomDomainResponse = await this.helper.updateCustomDomain(domainName, routes);
      if (
        updateCustomDomainResponse == undefined ||
        updateCustomDomainResponse.body == undefined ||
        updateCustomDomainResponse.body.routeConfig == undefined ||
        updateCustomDomainResponse.body.routeConfig.routes == undefined
      ) {
        throw new Error(
          `No response found when update custom domain: [${domainName}]. Please contact staff.`,
        );
      }
      // check if update successfully.
      const routesResponse = updateCustomDomainResponse.body.routeConfig.routes;
      if (
        _.isEmpty(routesResponse) !== _.isEmpty(routes) &&
        routes.length !== routesResponse.length
      ) {
        throw new Error(
          `Failed to update custom domain, the number of routes before and after the update is different`,
        );
      }
      for (const route of routesResponse) {
        if (
          route.serviceName === serviceName &&
          route.functionName === functionName &&
          route.qualifier !== aliasName
        ) {
          throw new Error(
            `Failed to update custom domain, the qualifiers of routes were not updated`,
          );
        }
      }
      this.logger.info(
        `Successfully updated custom domain: [${domainName}] by setting alias: [${aliasName}].`,
      );
    }
    this.logger.debug(`Finish updating custom domains.`);
  }
}

module.exports = { FunctionHelper: FunctionHelper };
