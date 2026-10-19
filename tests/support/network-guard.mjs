import process from "node:process";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import dgram from "node:dgram";
import { registerHooks, syncBuiltinESMExports } from "node:module";
import { assertIsolatedEnvironment, assertLocalTarget } from "./isolation.mjs";

const { NODE_OPTIONS, ...environment } = process.env;
assertIsolatedEnvironment(environment);
if (NODE_OPTIONS && NODE_OPTIONS !== `--import=${import.meta.url}`) throw new Error("TEST_ISOLATION: unexpected Node preload");
const mode = process.env.PARADS_TEST_MODE;
if (!["unit", "emulator"].includes(mode)) throw new Error("TEST_ISOLATION: use the test runner");

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options = typeof first === "object" ? first : { port: first, host: args[1] };
  if (!options || options.path) throw new Error("TEST_ISOLATION: socket paths blocked");
  assertLocalTarget(options.host, options.port, mode);
  return connect.apply(this, args);
};
const blocked = () => { throw new Error("TEST_ISOLATION: external transport blocked"); };
tls.connect = blocked;
dgram.createSocket = blocked;
const lookup = dns.lookup;
dns.lookup = function (hostname, ...args) {
  if (hostname !== "127.0.0.1" || mode !== "emulator") return blocked();
  return lookup.call(this, hostname, ...args);
};
dns.promises.lookup = async function (hostname, ...args) {
  if (hostname !== "127.0.0.1" || mode !== "emulator") return blocked();
  return new Promise((resolve, reject) => lookup(hostname, ...args, (error, address, family) => {
    if (error) reject(error);
    else resolve({ address, family });
  }));
};
const fetch = globalThis.fetch;
globalThis.fetch = function (input, options) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.protocol !== "http:") return blocked();
  assertLocalTarget(url.hostname, url.port || 80, mode);
  return fetch(input, { ...options, redirect: "error" });
};
if (globalThis.WebSocket) globalThis.WebSocket = class { constructor() { blocked(); } };
syncBuiltinESMExports();

// Importing production initialization must never silently connect a test to real data.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    const path = decodeURIComponent(new URL(result.url).pathname);
    if (/\/src\/firebase\/firebase(?:\.js)?$/i.test(path) || /\/scripts\/firebase-maintenance\.mjs$/i.test(path)) {
      throw new Error("TEST_ISOLATION: production Firebase entry point blocked");
    }
    return result;
  },
});
