import basicAuth from "basic-auth";

export const authenticate = (req, res, next) => {
  const user = basicAuth(req);

  const username = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!user || user.name !== username || user.pass !== password) {
    res.set("WWW-Authenticate", 'Basic realm="Authorization Required"');
    return res.status(401).send("Unauthorized");
  }

  next();
};
