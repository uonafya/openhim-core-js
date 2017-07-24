import Q from "q";
import logger from "winston";
import SDC from "statsd-client";
import os from "os";
import { ClientModel } from "../model/clients";
import { config } from "../config";

const statsdServer = config.get("statsd");
const application = config.get("application");

const domain = `${os.hostname()}.${application.name}.appMetrics`;
const sdc = new SDC(statsdServer);

const dummyClient = new ClientModel({
  clientID: "DUMMY-TCP-USER",
  clientDomain: "openhim.org",
  name: "DUMMY-TCP-USER",
  roles: ["tcp"]
});

export function authenticateUser(ctx, done) {
  ctx.authenticated = dummyClient;
  return done(null, dummyClient);
}

/*
 * Koa middleware for bypassing authentication for tcp requests
 */
export function* koaMiddleware(next) {
  let startTime;
  if (statsdServer.enabled) { startTime = new Date(); }
  const _authenticateUser = Q.denodeify(authenticateUser);
  yield _authenticateUser(this);

  if (this.authenticated != null) {
    if (statsdServer.enabled) { sdc.timing(`${domain}.tcpBypassAuthenticationMiddleware`, startTime); }
    return yield next;
  } else {
    this.response.status = 401;
    if (statsdServer.enabled) { return sdc.timing(`${domain}.tcpBypassAuthenticationMiddleware`, startTime); }
  }
}
