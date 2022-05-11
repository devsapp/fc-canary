const util = require('util')
function printObject(object) {
  return util.inspect(object, false, null, true /* enable colors */);
}

module.exports = {printObject};

