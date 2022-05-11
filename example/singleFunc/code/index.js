
/*
To enable the initializer feature (https://help.aliyun.com/document_detail/156876.html)
please implement the initializer function as below：
exports.initializer = (context, callback) => {
  console.log('initializing');
  callback(null, '');
};
*/

exports.handler = (req, resp) => {
  console.log("receive body: ", req.body.toString());
  resp.setHeader("Content-Type", "text/plain");
  resp.send('<h1>test1</h1>');
}
