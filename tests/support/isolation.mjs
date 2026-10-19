export const TEST_PROJECT_ID = "demo-parads-security";
export const EMULATOR_HOSTS = Object.freeze({
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:18080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:19099",
  FIREBASE_EMULATOR_HUB: "127.0.0.1:14400",
});

export function assertTestProject(projectId) {
  if (projectId !== TEST_PROJECT_ID) throw new Error("TEST_ISOLATION: only the fixed demo project is allowed");
}

export function assertIsolatedEnvironment(env) {
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    if (/^(FIREBASE_ADMIN_|VITE_FIREBASE_|GOOGLE_APPLICATION_CREDENTIALS$|GOOGLE_CLOUD_KEYFILE_JSON$|GOOGLE_AUTH_TOKEN$|GOOGLE_OAUTH_ACCESS_TOKEN$|FIREBASE_TOKEN$|GCLOUD_ACCESS_TOKEN$|CLOUDSDK_AUTH_|NODE_OPTIONS$)/i.test(key)) {
      throw new Error(`TEST_ISOLATION: forbidden credential/configuration variable ${key}`);
    }
    if (key === "FIREBASE_CONFIG") {
      let config;
      try { config = JSON.parse(value); } catch { throw new Error("TEST_ISOLATION: invalid CLI config"); }
      if (env.PARADS_TEST_MODE !== "emulator" || config?.projectId !== TEST_PROJECT_ID ||
        config.storageBucket !== `${TEST_PROJECT_ID}.appspot.com` || config.databaseURL !== `https://${TEST_PROJECT_ID}.firebaseio.com` ||
        Object.keys(config).sort().join(",") !== "databaseURL,projectId,storageBucket") {
        throw new Error("TEST_ISOLATION: only the generated demo CLI config is allowed");
      }
    }
    if (key === "FIREBASE_FIRESTORE_EMULATOR_ADDRESS" && value !== EMULATOR_HOSTS.FIRESTORE_EMULATOR_HOST) {
      throw new Error("TEST_ISOLATION: unexpected emulator address");
    }
    if (["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT", "FIREBASE_PROJECT_ID", "FIREBASE_PROJECT", "GCP_PROJECT"].includes(key)) assertTestProject(value);
    if (key.includes("EMULATOR") && key.endsWith("HOST")) {
      if (EMULATOR_HOSTS[key] !== value) throw new Error(`TEST_ISOLATION: unexpected emulator endpoint ${key}`);
    }
    if (key === "PARADS_TEST_MODE" && !["unit", "emulator"].includes(value)) throw new Error("TEST_ISOLATION: invalid test mode");
  }
}

export function isolatedEnvironment(env, mode) {
  assertIsolatedEnvironment(env);
  if (!["unit", "emulator"].includes(mode)) throw new Error("TEST_ISOLATION: invalid test mode");
  const platform = Object.fromEntries(Object.entries(env).filter(([key]) => /^(path|pathext|systemroot|windir|comspec|temp|tmp|java_home|home|userprofile|appdata|localappdata|lang|lc_all)$/i.test(key)));
  return {
    ...platform, ...EMULATOR_HOSTS,
    PARADS_TEST_MODE: mode,
    GCLOUD_PROJECT: TEST_PROJECT_ID,
    GOOGLE_CLOUD_PROJECT: TEST_PROJECT_ID,
    FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
    FIREBASE_CLI_DISABLE_MOTD: "true",
    CI: "true",
  };
}

export function assertLocalTarget(host, port, mode) {
  const allowed = Object.values(EMULATOR_HOSTS).includes(`${host}:${Number(port)}`);
  if (mode !== "emulator" || !allowed) throw new Error("TEST_ISOLATION: network destination blocked");
}
