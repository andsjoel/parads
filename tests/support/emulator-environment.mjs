import process from "node:process";
import "./network-guard.mjs";
import { readFile } from "node:fs/promises";
import { generateKeyPairSync } from "node:crypto";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { initializeApp, deleteApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { assertIsolatedEnvironment, assertTestProject, TEST_PROJECT_ID, EMULATOR_HOSTS } from "./isolation.mjs";
import { fixtureAccounts, fixtureDocuments, TEST_PASSWORD } from "../fixtures/security.mjs";

export async function createEmulatorEnvironment() {
  const { NODE_OPTIONS: _options, ...env } = process.env;
  assertIsolatedEnvironment(env);
  assertTestProject(process.env.GCLOUD_PROJECT);
  if (process.env.PARADS_TEST_MODE !== "emulator") throw new Error("TEST_ISOLATION: integration tests require emulator mode");
  for (const [key, expected] of Object.entries(EMULATOR_HOSTS)) {
    if (process.env[key] !== expected) throw new Error("TEST_ISOLATION: both emulators and hub must be explicit");
  }
  // Probe both services before clearing or seeding any local data. No fallback exists.
  for (const url of [
    `http://${EMULATOR_HOSTS.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${TEST_PROJECT_ID}/config`,
    `http://${EMULATOR_HOSTS.FIRESTORE_EMULATOR_HOST}/`,
  ]) {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("TEST_ISOLATION: an emulator is unavailable");
  }
  const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");
  const rulesEnv = await initializeTestEnvironment({ projectId: TEST_PROJECT_ID, firestore: { host: "127.0.0.1", port: 18080, rules } });
  // An ephemeral, unregistered certificate satisfies the Admin SDK type check.
  // Emulator requests bypass OAuth; this key cannot authenticate to a real project.
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const admin = initializeApp({ projectId: TEST_PROJECT_ID, credential: cert({
    projectId: TEST_PROJECT_ID, clientEmail: `fixture@${TEST_PROJECT_ID}.iam.gserviceaccount.com`, privateKey,
  }) }, "isolated-fixtures");
  const auth = getAuth(admin);
  const db = getFirestore(admin);
  try {
    await rulesEnv.clearFirestore();
    const cleared = await fetch(`http://${EMULATOR_HOSTS.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${TEST_PROJECT_ID}/accounts`, { method: "DELETE" });
    if (!cleared.ok) throw new Error("Cannot reset local Auth emulator");
    for (const { uid } of [...fixtureAccounts, { uid: "fixture-outsider" }]) {
      await auth.createUser({ uid, email: `${uid}@example.test`, password: TEST_PASSWORD });
    }
    const batch = db.batch();
    for (const [path, data] of Object.entries(fixtureDocuments())) batch.set(db.doc(path), data);
    await batch.commit();
  } catch (error) {
    await rulesEnv.cleanup();
    await deleteApp(admin);
    throw error;
  }
  return { rulesEnv, auth, db, async cleanup() { await rulesEnv.cleanup(); await db.terminate(); await deleteApp(admin); } };
}
