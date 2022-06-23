exports.handler = (req, resp) => {
  console.log("receive body: ", req.body.toString());
  resp.setHeader("Content-Type", "text/plain");
  // throw new Error("My error");
  resp.send('<h1>hello world</h1>');
}
