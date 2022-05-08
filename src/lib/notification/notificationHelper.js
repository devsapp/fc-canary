const crypto = require('crypto');
const https = require('https');

class NotificationHelper {
  constructor(logger, plans) {
    this.logger = logger;
    this.plans = plans;
  }

  async dingTalkGroupRobot(data, config) {
    const accessToken = config.accessToken;
    // specially @ someone.
    const secret = config.secret;
    const message = data || '';
    const hostname = 'oapi.dingtalk.com';
    const path = '/robot/send';

    if (accessToken == undefined) {
      this.logger.error('No accessToken found in dingTalk configuration');
      return;
    }
    if (secret == undefined) {
      this.logger.error('No secret found in dingTalk configuration');
      return;
    }

    let atUserIds = (config && config.atUserIds) || [];
    let atMobiles = (config && config.atMobiles) || [];
    let isAtAll = (config && config.isAtAll) || false;
    if (atUserIds.constructor.name !== 'Array') {
      this.logger.error('atUserIds is not an array');
      atUserIds = [];
    }
    if (atMobiles.constructor.name !== 'Array') {
      this.logger.error('atMobiles is not an array');
      atMobiles = [];
    }
    if (isAtAll.constructor.name !== 'Boolean') {
      this.logger.error('isAtAll is not Boolean');
      isAtAll = false;
    }

    // crypto, 钉钉机器人的配置
    const timeStamp = new Date().getTime();
    let sign = `${timeStamp}\n${secret}`;

    const hash = crypto.createHmac('sha256', secret).update(sign, 'utf8').digest('base64');
    const newPath = path + `?access_token=${accessToken}&timestamp=${timeStamp}&sign=${hash}`;

    const messageWrap = JSON.stringify({
      at: {
        atMobiles: atMobiles,
        atUserIds: atUserIds,
        isAtAll: isAtAll,
      },
      msgtype: 'text',
      text: { content: message },
    });
    console.error(messageWrap);
    await this.httpsSend(messageWrap, hostname, newPath, 'dingTalkRobot');
  }

  async notify(data) {
    if (this.plans && typeof this.plans[Symbol.iterator] === 'function') {
      for (const plan of this.plans) {
        if (plan.type === 'dingTalkRobot') {
          try {
            await this.dingTalkGroupRobot(data, plan.config);
            this.logger.info('Successfully notified users through dingTalk robot.');
          } catch (e) {
            // no need to stop the process.
            this.logger.error(e);
          }
        }
      }
    }
  }

  async httpsSend(data, hostname, newPath, notifyType) {
    let postData = data;

    let options = {
      hostname: hostname,
      port: 443,
      path: newPath,

      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
      },
    };

    const doHttps = new Promise(() => {
      const req = https.request(options, (res) => {
        res.on('data', (data) => {
          if (data != undefined) {
            const dataObj = JSON.parse(data);
            if (dataObj.errcode != undefined && dataObj.errcode === 0) {
              this.logger.debug(`Successfully notified through ${notifyType}.`);
            } else {
              this.logger.error(
                `Failed to notify through ${notifyType}, error: ${JSON.stringify(
                  dataObj,
                  null,
                  2,
                )}`,
              );
            }
          }
        });
      });
      req.on('error', (e) => {
        this.logger.error(
          `Failed to notify through ${notifyType}, error: ${JSON.stringify(e, null, 2)}`,
        );
      });
      req.write(postData);
      req.end();
    });
    await doHttps;
  }
}

module.exports = { NotificationHelper: NotificationHelper };
