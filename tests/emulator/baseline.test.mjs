import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, doc, getDoc, getDocs, collection, setDoc, updateDoc, onSnapshot, writeBatch } from "firebase/firestore";
import { createEmulatorEnvironment } from "../support/emulator-environment.mjs";
import { TEST_PROJECT_ID } from "../support/isolation.mjs";
import { TEST_PASSWORD } from "../fixtures/security.mjs";

let environment;
before(async () => { environment = await createEmulatorEnvironment(); });
after(async () => { await environment?.cleanup(); });

test("baseline: members, provisioned guests and admins can read public profiles and live lists", async () => {
  for (const uid of ["fixture-member", "fixture-guest", "fixture-admin"]) {
    const db = environment.rulesEnv.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, "public_profiles/fixture-member")));
    await assertSucceeds(getDoc(doc(db, "volley_lists/fixture-day")));
  }
});

test("baseline: anonymous visitors cannot read profiles, lists, inventory or reports", async () => {
  const db = environment.rulesEnv.unauthenticatedContext().firestore();
  for (const path of ["public_profiles/fixture-member", "volley_lists/fixture-day", "user_inventory/fixture-member", "volley_reports/fixture-report"]) {
    await assertFails(getDoc(doc(db, path)));
  }
});

test("baseline: members cannot read another private account, grant admin role or write invitations", async () => {
  const db = environment.rulesEnv.authenticatedContext("fixture-member").firestore();
  await assertFails(getDoc(doc(db, "users/fixture-admin")));
  await assertFails(updateDoc(doc(db, "users/fixture-member"), { role: "admin" }));
  await assertFails(setDoc(doc(db, "pre_registered_users/5561000000099"), { enabled: true }));
  await assertFails(setDoc(doc(db, "account_security/fixture-member"), { passwordChangeRequired: false }));
});

test("baseline: admin can manage a provisioned pending guest without changing balances and history", async () => {
  const db = environment.rulesEnv.authenticatedContext("fixture-admin").firestore();
  const before = (await getDoc(doc(db, "users/fixture-guest"))).data();
  assert.equal(before.firstAccessPending, true);
  assert.equal(before.progression.coins, 17);
  await assertSucceeds(updateDoc(doc(db, "users/fixture-guest"), { fullName: "Synthetic guest edited" }));
  assert.equal((await getDoc(doc(db, "user_stats/fixture-guest"))).data().wins, 3);
  assert.equal((await getDoc(doc(db, "users/fixture-guest"))).data().progression.coins, 17);
});

test("stage 2: invitations and username directories reject anonymous reads and queries", async () => {
  const db = environment.rulesEnv.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(db, "pre_registered_users")));
  await assertFails(getDocs(collection(db, "usernames")));
  await assertFails(getDoc(doc(db, "pre_registered_users/5561000000002")));
  await assertFails(getDoc(doc(db, "usernames/fixture-member")));
});

test("stage 2: an Auth identity with no invitation cannot read group data or claim membership", async () => {
  const db = environment.rulesEnv.authenticatedContext("fixture-outsider").firestore();
  await assertFails(getDoc(doc(db, "user_stats/fixture-member")));
  await assertFails(getDoc(doc(db, "volley_lists/fixture-day")));
  await assertFails(setDoc(doc(db, "users/fixture-outsider"), { role: "member", type: "member", phone: "5561000000002" }));
  await assertFails(setDoc(doc(db, "registration_grants/fixture-outsider"), { role: "admin" }));
});

test("stage 2: disabled invitations revoke group reads", async () => {
  const db = environment.rulesEnv.authenticatedContext("fixture-disabled").firestore();
  await assertFails(getDoc(doc(db, "public_profiles/fixture-member")));
});

test("stage 2: identity fields cannot be forged but profile personalization and trusted-member stats still work", async () => {
  const db = environment.rulesEnv.authenticatedContext("fixture-member").firestore();
  for (const changes of [{ phone: "5561000000001" }, { type: "admin" }, { authEmail: "admin@parads.local" }, { username: "admin" }, { inviteId: "5561000000001" }, { firstAccessPending: true }]) {
    await assertFails(updateDoc(doc(db, "users/fixture-member"), changes));
  }
  await assertSucceeds(updateDoc(doc(db, "users/fixture-member"), { "profile.displayName": "Synthetic customized" }));
  await assertSucceeds(updateDoc(doc(db, "user_stats/fixture-member"), { wins: 4 }));
});

test("stage 2: legacy local-phone IDs and type-only roles remain valid without new fields", async () => {
  await environment.db.doc("users/fixture-legacy").set({ phone: 5561000000011, type: "member" });
  await environment.db.doc("pre_registered_users/61000000011").set({ enabled: true, claimed: true, userId: "fixture-legacy", type: "member" });
  const db = environment.rulesEnv.authenticatedContext("fixture-legacy").firestore();
  await assertSucceeds(getDoc(doc(db, "volley_lists/fixture-day")));
  await environment.db.doc("pre_registered_users/61000000011").update({ userId: "another-uid" });
  await assertFails(getDoc(doc(db, "volley_lists/fixture-day")));
});

test("stage 2: a disabled primary invitation cannot fall through to a stale enabled duplicate", async () => {
  await environment.db.doc("pre_registered_users/61000000004").set({ enabled: true, claimed: true, userId: "fixture-disabled", role: "member" });
  const db = environment.rulesEnv.authenticatedContext("fixture-disabled").firestore();
  await assertFails(getDoc(doc(db, "volley_lists/fixture-day")));
});

test("stage 2: admin can write match results and twelve player stats in one batch", async () => {
  const db = environment.rulesEnv.authenticatedContext("fixture-admin").firestore();
  const batch = writeBatch(db);
  for (let index = 0; index < 12; index++) batch.set(doc(db, "user_stats", `synthetic-result-${index}`), { wins: 1, matchesPlayed: 1 });
  batch.update(doc(db, "volley_lists/fixture-day"), { games: [{ winner: "synthetic-team" }] });
  await assertSucceeds(batch.commit());
});

test("stage 2: password-change restriction still allows own bootstrap but blocks group access", async () => {
  await environment.db.doc("account_security/fixture-member").set({ passwordChangeRequired: true, invalidBefore: 0 });
  const db = environment.rulesEnv.authenticatedContext("fixture-member", { auth_time: Math.floor(Date.now() / 1000) }).firestore();
  try {
    await assertSucceeds(getDoc(doc(db, "users/fixture-member")));
    await assertSucceeds(getDoc(doc(db, "account_security/fixture-member")));
    await assertFails(getDoc(doc(db, "volley_lists/fixture-day")));
  } finally { await environment.db.doc("account_security/fixture-member").delete(); }
});

test("real local Auth login and Firestore listener receive a match update without polling", async () => {
  const app = initializeApp({ projectId: TEST_PROJECT_ID, apiKey: "fake-test-key" }, "integration-client");
  let unsubscribe;
  let timer;
  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, "http://127.0.0.1:19099", { disableWarnings: true });
    const db = getFirestore(app);
    connectFirestoreEmulator(db, "127.0.0.1", 18080);
    const login = await signInWithEmailAndPassword(auth, "fixture-member@example.test", TEST_PASSWORD);
    assert.equal(login.user.uid, "fixture-member");
    const received = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Local realtime update timed out")), 10_000);
      let written = false;
      unsubscribe = onSnapshot(doc(db, "volley_lists/fixture-day"), (snapshot) => {
        if (snapshot.data()?.revision === 1) resolve();
        else if (!written && snapshot.exists()) {
          written = true;
          environment.db.doc("volley_lists/fixture-day").update({ revision: 1 }).catch(reject);
        }
      }, reject);
    });
    await received;
  } finally {
    clearTimeout(timer);
    unsubscribe?.();
    await deleteApp(app);
  }
});

test("emergency rules deny all client roles without deleting data; restoring local rules restores reads", async () => {
  const original = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");
  const emergency = await readFile(new URL("../fixtures/emergency-deny.rules", import.meta.url), "utf8");
  let locked;
  let restored;
  try {
    locked = await initializeTestEnvironment({ projectId: TEST_PROJECT_ID, firestore: { host: "127.0.0.1", port: 18080, rules: emergency } });
    for (const uid of ["fixture-admin", "fixture-member", "fixture-guest"]) {
      const db = locked.authenticatedContext(uid).firestore();
      await assertFails(getDoc(doc(db, "volley_lists/fixture-day")));
      await assertFails(setDoc(doc(db, "feed_posts/blocked"), { title: "blocked" }));
    }
    assert.equal((await environment.db.doc("users/fixture-member").get()).data().progression.coins, 17);
    assert.equal((await environment.db.doc("volley_lists/fixture-day").get()).exists, true);
  } finally {
    restored = await initializeTestEnvironment({ projectId: TEST_PROJECT_ID, firestore: { host: "127.0.0.1", port: 18080, rules: original } });
    try {
      await assertSucceeds(getDoc(doc(restored.authenticatedContext("fixture-member").firestore(), "volley_lists/fixture-day")));
    } finally {
      await locked?.cleanup();
      await restored.cleanup();
    }
  }
});
