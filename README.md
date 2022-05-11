# Fc-canary Plugin
本插件帮助您通过 [Serverless-Devs](https://github.com/Serverless-Devs/Serverless-Devs/) 工具和 [FC组件](https://github.com/devsapp/fc/) 实现函数的灰度发布能力

- [快速开始](#快速开始)
  - [基本参数](#基本参数)
  - [灰度策略](#灰度策略)
- [操作案例](#操作案例)
  - [单函数发布](#单函数发布)
  - [多函数发布](#多函数发布) （即将发布）

## 快速开始
在部署钩子 post-deploy 中声明该插件，实现函数部署后的灰度发布。插件本质上是操作 Service 的版本以及别名，并且更新涉及别名的Trigger、Custom Domain


```yaml
actions:
  post-deploy: # 在deploy之后运行
    - plugin: fc-canary
      args:
        description: 'test canary'
        baseVersion: 1 #基线版本，如果指定则使用该版本做为主版本和灰度版本进行切换
        canaryStep: # 灰度20%流量，10分钟后灰度剩余80%流量
          weight: 20
          interval: 10
        # canaryWeight: 10 #手动灰度，指定时直接将灰度版本设置对应的权重
        # canaryPlans: #自定义灰度
        #   - weight: 10
        #     intervalMinutes: 5
        #   - weight: 30
        #     intervalMinutes: 10
        # linearStep:
        #   weight: 20
        #   interval: 1
```

### 基本参数

| 参数名称        | 参数含义                                                                                                                 | 必填    | 默认值                            | 例子             |
|-------------|----------------------------------------------------------------------------------------------------------------------|-------|--------------------------------|----------------|
| alias       | 别名。 不指定则使用 `${functionName}_stable`                                                                                  | false | 关联组件的 `${functionName}_stable` | stable         |
| description | 发布描述。版本及别名都使用该描述                                                                                                     | false | ''                             | canary testing |
| baseVersion | 基线版本。如果指定则使用该版本做为主版本和灰度版本进行切换<br/> Full release 时不可以配置baseVersion.  | false | BaseVersion未填写时，系统将把baseVersion设置为新创建version的前一个                           | 1              |

### 灰度策略
描述具体的灰度策略，以下参数只能选择一个，如果不指定则不进行灰度，直接将新版本的权重设置成100
* `canaryStep`: 灰度发布，灰度指定流量，间隔指定时间后再灰度剩余流量
  * `weight`: 灰度流量(百分比)，`必填`，1 <= weight <= 100, 且 weight 为整数。
  * `interval`: 灰度间隔(分钟)，非必填，默认值 10
  ```yaml
  canaryStep:
    weight: 20
    interval: 10
  ```
* `linearStep`：分批发布，每批固定流量，间隔指定时间后再开始下一个批次
  * `weight`: 灰度流量(百分比)，`必填`，1 <= weight <= 100, 且 weight 为整数。
  * `interval`: 灰度间隔(分钟)，非必填，默认值 1
  ```yaml
  linearStep:
    weight: 10
    interval: 2
  ```
* `canaryPlans`：数组，自定义灰度批次
  * `weight`: 灰度流量(百分比)，`必填`，1 <= weight <= 100, 且 weight 为整数。
  * `interval`: 灰度间隔(分钟)，`必填`
  ```yaml
  canaryPlans: # 10% -> (5分钟后) 50% > (10分钟后) 100%
    - weight: 10
      interval: 5
    - weight: 50
      interval: 10
  ```
* `canaryWeight`：手动灰度，直接对灰度版本设置对应的权重，1 <= weight <= 100, 且 weight 为整数。
### 工作流程
![alt](https://img.alicdn.com/imgextra/i2/O1CN01ivqpnL1fiMrIzbGD1_!!6000000004040-2-tps-1122-483.png)

### 钉钉群组机器人提醒 (可选功能)
FC-canary插件可以通过钉钉群组机器人向群组内发送当前的发布状态。
* 配置钉钉群组自定义机器人，详见[链接](https://open.dingtalk.com/document/robots/custom-robot-access)
  * 机器人选择 **加签** 的安全设置，获取secret。
  * 配置完成机器人后，从机器人的Webhook中获取access_token。
* 在yaml中配置钉钉群组机器人。
  ```yaml
  args:
    notification:
      - dingTalkRobot:
        accessToken: 获取到的access_token
        secret: 获取到的secret
        atUserIds:
          - xxx
          - xxx
        atMobiles:
          - xxx
          - xxx
        isAtAll: false  
  ```
  * 钉钉群组机器人基本参数

| 参数名称      | 参数含义                                           | 必填    | 默认值   | 例子          |
|--------------------------------------------------|------------------------------------------------|-------|-------|-------------|
| accessToken | 钉钉群组机器人访问token，类型为string                       | true  | 必填    |             |
| secret | 钉钉机器人加签秘钥，类型为string                            | true  | 必填    |             |
| atUserIds | 被at人员的userid，类型为数组                             | false | null  | 368XXX      |   
| atMobiles | 被at人员的手机号，类型为数组，**只有群内人员的手机号才有效，非群内成员手机号会被脱敏** | false | null  | 176xxxxxxxx |
| isAtAll   | at所有人，类型为boolean                               | false | false | true        |


## 操作案例
### 单函数发布
```yaml
edition: 1.0.0 #  命令行YAML规范版本，遵循语义化版本（Semantic Versioning）规范
name: demo-app #  项目名称
access: 'default' #  秘钥别名

vars:
  region: cn-hangzhou
  service: # service 配置原则上不能修改， 如果有改动，请和 fengchong/xiliu 对齐下
    name: demo-service
    logConfig: auto
    nasConfig: auto

services:
  dummy-function:
    component: devsapp/fc
    actions:
      post-deploy: # 在deploy之后运行
        - plugin: fc-canary
          args:
            notification:
              - dingTalkRobot:
                accessToken: xxx
                secret: xxx
                atUserIds:
                  - xxx
                  - xxx
                atMobiles:
                  - xxx
                  - xxx
                isAtAll: false
            alias: stable
            canaryStep:
              weight: 10
              interval: 1
    props: 
      region: cn-hangzhou
      service:
        name: dummy-service
        logConfig: auto
        nasConfig: auto
      function:
        handler: index.handler
        instanceType: e1
        memorySize: 1024
        runtime: nodejs12
        timeout: 60
        name: dummy-function
        codeUri: .
      triggers:
        - name: httpTrigger
          type: http
          config:
            authType: anonymous
            methods:
              - GET
      customDomains:
        - domainName: auto
          protocol: HTTP
          routeConfigs:
            - path: '/*'

```
上述例子的执行过程是：
* 部署
   1. 部署 Service
   2. 部署 Function
   3. 部署 Trigger（使用LATEST）
   4. 部署 CustomDomain（使用LATEST）
* 执行插件
   1. 发布版本，记录新版本 new 及当前线上版本 base
   2. 创建别名，更新Trigger、Custom Domain，指向别名
   3. 更新别名，为版本 new 分配 10% 流量，版本 base 分配 90% 流量
   4. 等待1分钟
   5. 更新别名，为版本 new 分配 100% 流量
   
![alt](https://img.alicdn.com/imgextra/i1/O1CN01exh14j1Wsb9zOcAIU_!!6000000002844-2-tps-2248-508.png)
#### 演示：
![canaryPlan](https://img.alicdn.com/imgextra/i4/O1CN01UGr90L240jWIAbOMq_!!6000000007329-1-tps-1777-982.gif)

### 多函数发布
依赖全局action的能力改造，敬请期待！
