const {singleFunc} = require('./helper/singleFunctionHelper');



/**
 * Plugin 插件入口
 * 这个插件是deploy之后执行
 * @param inputs 组件的入口参数
 * @param args 插件的自定义参数（详见README.md 基本参数 和 灰度策略）
 * @return inputs
 */

module.exports = async function index(inputs, args = {}) {
  let isSingleFunction = true;

  if (isSingleFunction) {
    await singleFunc(inputs, args);
  } else {
    // todo multiple function
  }

  delete inputs.output;
  return inputs;
};






