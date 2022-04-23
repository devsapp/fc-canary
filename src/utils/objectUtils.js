function printObject(object) {
  let output = '';
  for (const property in object) {
    output += '  ' + property + ': ' + object[property]+';\n';
  }
  return output;
}

module.exports = {printObject};

