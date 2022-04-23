const _ = require("lodash");

class FunctionHelper {

  constructor(helper, logger) {
    this.helper = helper;
    this.logger = logger;
  }

  /**
   *
   * @param service
   * @param description
   * @returns {Promise<*>}
   */
  async publishVersion(service, description) {
    const versionPublishedResponse = await this.helper.publishVersion(service, description);
    if (versionPublishedResponse === undefined || versionPublishedResponse.body === undefined || versionPublishedResponse.body.versionId === undefined) {
      throw new Error(`No response from the system when publish version, serviceName: ${service}, description: ${description}, please contact staff.`);
    }
    return versionPublishedResponse.body.versionId;


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
   * @param aliasVersion
   * @returns {Promise<*>}
   */
  async findBaseVersion(baseVersion, aliasName, serviceName, aliasVersion) {
    let getAliasResponse;
    try {

      getAliasResponse = await this.helper.getAlias(serviceName, aliasName);
      if (getAliasResponse === undefined || getAliasResponse.body === undefined) {
        throw new Error(`No response from the system when finding alias,` +
          ` serviceName: ${serviceName}, aliasName: ${aliasName}, please contact staff.`);
      }
    } catch (e) {
      // if Alias not found, the system will throw an error.
      if (e.message.indexOf('AliasNotFound') !== -1) {
        this.logger.log(`Alias ${aliasName} doesn't exist, we will create alias ${aliasName}, service: ${service}`);
      } else {
        throw e;
      }
    }
    // if aliasName exists, set the version of the aliasName to baseVersion
    if (getAliasResponse !== undefined) {
      baseVersion = getAliasResponse.body && getAliasResponse.body.versionId;

    } else {
      // if aliasName doesn't exist, set the previous version of new created aliasName version to baseVersion
      const versionListResponse = await this.helper.listVersion(serviceName);
      if (versionListResponse === undefined || versionListResponse.body === undefined) {
        this.logger.log(`System error in listing versions, please contact the staff, service: ${serviceName}`);
      }
      const versionList = versionListResponse.body && versionListResponse.body.versions;

      this.logger(`Current versions are ${JSON.stringify(versionList, null, 2)}`);

      if (versionList === null || versionList === undefined ||  (versionList.constructor.name !== 'Array' && _.isEmpty(versionList))) {
        throw new Error(`New published version has been deleted, versionId: ${aliasVersion}`);
      }

      // if versionList only contains one version and the versionId equals to aliasVersion,
      // it defers to user would like to fully release. warn user that there service will fully release
      if (versionList.length == 1) {
        if (versionList[0].versionId !== aliasVersion) {
          throw new Error(`New published version has been deleted, versionId: ${aliasVersion}`);
        }


        // full to aliasName
        // // 用户此时删除了version怎么办？ 抛错误
        // this.logger.log(`Begin to create a new aliasName`);
        // const createAliasResponse = await this.helper.createAlias(service, null, aliasName, description, grayVersion.toString(), 100);
        // if (createAliasResponse === undefined || createAliasResponse.body === undefined) {
        //   throw new Error(`System error in creating aliasName, please contact the staff, service: ${service}, aliasName: ${aliasName}`);
        // }
        //
        // if (createAliasResponse.body.aliasName !== aliasName) {
        //   throw new Error(`Create aliasName Error, response aliasName name: ${createAliasResponse.body.aliasName}, expected aliasName name: ${aliasName}`);
        // }
      }
      // set the previous version of new created aliasName version to baseVersion
      if (versionList.length > 1) {
        if (versionList.find(item => item.versionId === aliasVersion) === undefined) {
          throw new Error(`New published version has been deleted, versionId: ${aliasVersion}`);
        } else {
          versionList.sort((a, b) => {
            const aDate = new Date(a.lastModifiedTime);
            const bDate = new Date(b.lastModifiedTime);
            if (aDate.before(bDate)) {
              return -1;
            } else if (aDate.after(bDate)) {
              return 1;
            } else {
              return 0;
            }
          });
          const index = versionList.findIndex(item => item.versionId === aliasVersion);
          if (index <= 0) {
            throw new Error(`New created version is the oldest version, can't find a baseVersion`);
          } else {
            baseVersion = versionList[index - 1].versionId;
          }
        }


      }


    }


    return baseVersion;
  }


}

module.exports = {FunctionHelper: FunctionHelper};
