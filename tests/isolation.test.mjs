import assert from "node:assert/strict";
import "./support/network-guard.mjs";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import process from "node:process";
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import { assertIsolatedEnvironment, assertLocalTarget, assertTestProject, isolatedEnvironment, TEST_PROJECT_ID } from "./support/isolation.mjs";

test("only the exact demo project is permitted", () => {
  assert.doesNotThrow(() => assertTestProject(TEST_PROJECT_ID));
  for (const project of ["parads-app-26f23", "demo-another", "", undefined]) assert.throws(() => assertTestProject(project), /TEST_ISOLATION/);
});

test("credentials, real projects, injected Node options and external emulator hosts fail closed", () => {
  for (const env of [
    { GOOGLE_APPLICATION_CREDENTIALS: "do-not-open.json" },
    { FIREBASE_ADMIN_PRIVATE_KEY: "fake-key" },
    { FIREBASE_ADMIN_PROJECT_ID: TEST_PROJECT_ID },
    { FIREBASE_TOKEN: "fake-token" },
    { VITE_FIREBASE_API_KEY: "fake-key" },
    { FIREBASE_CONFIG: "{}" },
    { PARADS_TEST_MODE: "emulator", FIREBASE_CONFIG: JSON.stringify({ projectId: "parads-app-26f23" }) },
    { NODE_OPTIONS: "--require=unsafe.js" },
    { GCLOUD_PROJECT: "parads-app-26f23" },
    { FIRESTORE_EMULATOR_HOST: "firestore.googleapis.com:443" },
    { FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099" },
    { FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:9000" },
  ]) assert.throws(() => isolatedEnvironment(env, "unit"), /TEST_ISOLATION/);
  assert.doesNotThrow(() => assertIsolatedEnvironment(isolatedEnvironment({}, "emulator")));
  assert.equal(isolatedEnvironment({ UNRELATED_API_SECRET: "do-not-pass" }, "unit").UNRELATED_API_SECRET, undefined);
});

test("only exact loopback emulator ports are allowed, and unit tests have no network", () => {
  assert.doesNotThrow(() => assertLocalTarget("127.0.0.1", 18080, "emulator"));
  for (const target of [["127.0.0.1", 443, "emulator"], ["localhost", 18080, "emulator"], ["127.0.0.1.evil.test", 18080, "emulator"], ["127.0.0.1", 18080, "unit"]]) {
    assert.throws(() => assertLocalTarget(...target), /TEST_ISOLATION/);
  }
});

test("actual fetch, HTTP, TCP and TLS production attempts are rejected before sending", () => {
  assert.throws(() => fetch("https://firestore.googleapis.com"), /TEST_ISOLATION/);
  assert.throws(() => fetch("http://169.254.169.254/computeMetadata/v1/"), /TEST_ISOLATION/);
  assert.throws(() => http.get("http://example.com"), /TEST_ISOLATION/);
  assert.throws(() => net.connect({ host: "firestore.googleapis.com", port: 443 }), /TEST_ISOLATION/);
  assert.throws(() => tls.connect({ host: "identitytoolkit.googleapis.com", port: 443 }), /TEST_ISOLATION/);
});

test("production client initialization cannot be imported", async () => {
  await assert.rejects(import("../src/firebase/firebase.js"), /TEST_ISOLATION/);
  await assert.rejects(import("../src/firebase/firebase.js?fresh"), /TEST_ISOLATION/);
});

test("a child process inherits network blocking", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", 'await fetch("https://firestore.googleapis.com")'], { encoding: "utf8", timeout: 10_000 });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TEST_ISOLATION/);
});

test("the runner rejects production configuration rather than silently replacing it", () => {
  const { NODE_OPTIONS: _options, ...env } = process.env;
  const result = spawnSync(process.execPath, ["scripts/test-isolated.mjs", "unit"], {
    env: { ...env, GCLOUD_PROJECT: "parads-app-26f23" }, encoding: "utf8", timeout: 10_000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TEST_ISOLATION/);
});

test("the runner rejects credentials without leaking their contents", () => {
  const { NODE_OPTIONS: _options, ...env } = process.env;
  const secret = "synthetic-secret-must-not-appear-in-output";
  const result = spawnSync(process.execPath, ["scripts/test-isolated.mjs", "unit"], {
    env: { ...env, FIREBASE_ADMIN_PRIVATE_KEY: secret }, encoding: "utf8", timeout: 10_000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TEST_ISOLATION/);
  assert.equal(`${result.stdout}${result.stderr}`.includes(secret), false);
});

test("unit mode cannot seed or initialize the integration fixtures", async () => {
  const { createEmulatorEnvironment } = await import("./support/emulator-environment.mjs");
  await assert.rejects(createEmulatorEnvironment(), /integration tests require emulator mode/);
});
