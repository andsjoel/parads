import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";

async function createHarness() {
  const documents = new Map();
  const authCalls = [];
  const snapshot = (path) => ({ exists: () => documents.has(path), data: () => documents.get(path) });
  const firestore = {
    doc: (_db, collection, id) => `${collection}/${id}`,
    serverTimestamp: () => "server-time",
    getDoc: async (path) => snapshot(path),
    runTransaction: async (_db, callback) => {
      const writes = [];
      const result = await callback({
        get: async (path) => snapshot(path),
        set: (path, data, options) => writes.push(() => documents.set(path, options?.merge ? { ...documents.get(path), ...data } : data)),
        update: (path, data) => writes.push(() => documents.set(path, { ...documents.get(path), ...data })),
      });
      writes.forEach((write) => write());
      return result;
    },
    collection() {}, getDocs() {}, writeBatch() {}, orderBy() {}, query() {},
  };
  const mocks = {
    "firebase/firestore": firestore,
    "../utils/publicProfileCache": { invalidatePublicProfileCache() {} },
    "../firebase/firebase": { db: {}, auth: {} },
    "firebase/auth": { signOut: async () => {} },
    "../utils/authEmail": { buildAuthEmail: (username) => `${username}@parads.local` },
    "../data/economy": { INITIAL_COIN_BALANCE: 5 },
    "./accessGatewayService": {
      requestAccess: async ({ action, username }) => {
        assert.equal(action, "login");
        return { authEmail: documents.get(`usernames/${username}`)?.authEmail || `${username}@parads.local` };
      },
    },
    "./accessCodeService": {
      generateAccessCode: () => "123456",
      generateAccessCodeSalt: () => "salt",
      hashAccessCode: async () => "hash",
    },
    "./guestAccountService": {
      provisionGuestAccount: async ({ email, save }) => {
        authCalls.push({ email });
        return save("guest-auth-uid");
      },
      replacePendingGuestCode: async ({ email, oldCode, newCode, save }) => {
        authCalls.push({ email, oldCode, newCode });
        return save();
      },
    },
  };
  const modules = new Map();
  async function load(name) {
    if (modules.has(name)) return modules.get(name);
    const source = await readFile(new URL(`../src/services/${name}.js`, import.meta.url), "utf8");
    const module = new SourceTextModule(source);
    modules.set(name, module);
    await module.link(async (specifier) => {
      if (specifier === "./userDefaults") return load("userDefaults");
      const values = mocks[specifier];
      if (!values) throw new Error(`Unexpected dependency: ${specifier}`);
      return new SyntheticModule(Object.keys(values), function () {
        Object.entries(values).forEach(([key, value]) => this.setExport(key, value));
      });
    });
    await module.evaluate();
    return module;
  }
  return {
    documents, authCalls,
    invites: (await load("preRegisterService")).namespace,
    users: (await load("userService")).namespace,
    login: (await load("authServices")).namespace,
  };
}

test("guest invite immediately provisions all profile data under the Auth UID", async () => {
  const { invites, documents } = await createHarness();
  const invite = await invites.createPreRegister({ fullName: "Visitor", phone: "61999999999", role: "guest", sex: "female" });
  assert.equal(invite.claimed, false);
  assert.equal(invite.userId, "guest-auth-uid");
  assert.equal(invite.user.id, invite.userId);
  assert.equal(documents.get(`users/${invite.userId}`).firstAccessPending, true);
  for (const collection of ["user_stats", "user_inventory", "user_showcase", "public_profiles"]) {
    assert.ok(documents.has(`${collection}/${invite.userId}`));
  }
  assert.equal(documents.get(`user_stats/${invite.userId}`).wins, 0);
});

test("first access preserves guest history, coins and inventory with the same UID", async () => {
  const { invites, users, documents, login } = await createHarness();
  const invite = await invites.createPreRegister({ fullName: "Visitor", phone: "61999999999", role: "guest", sex: "male" });
  const uid = invite.userId;
  const stats = { matchesPlayed: 11, wins: 7, attendanceConfirmed: 3, bestStreak: 5, claimedMissionIds: ["wins-2"] };
  const inventory = { displayCards: ["display-card-shiny"] };
  documents.set(`user_stats/${uid}`, stats);
  documents.set(`user_inventory/${uid}`, inventory);
  documents.get(`users/${uid}`).progression.coins = 42;
  await users.createUserBaseData({ uid, preRegister: invite, username: "visitor", authEmail: invite.pendingAuthEmail });
  assert.deepEqual(documents.get(`user_stats/${uid}`), stats);
  assert.deepEqual(documents.get(`user_inventory/${uid}`), inventory);
  assert.equal(documents.get(`users/${uid}`).progression.coins, 42);
  assert.equal(documents.get(`users/${uid}`).firstAccessPending, false);
  assert.equal(documents.get(`public_profiles/${uid}`).progression.coins, 42);
  assert.equal(documents.get("pre_registered_users/5561999999999").claimed, true);
  assert.equal(documents.get("usernames/visitor").uid, uid);
  assert.equal(documents.get("usernames/visitor").authEmail, invite.pendingAuthEmail);
  assert.equal(await login.resolveLoginEmail("VISITOR"), invite.pendingAuthEmail);
  documents.set("usernames/legacy", { uid: "old-user" });
  assert.equal(await login.resolveLoginEmail("legacy"), "legacy@parads.local");
});

test("a duplicate phone is rejected before creating another Auth account", async () => {
  const { invites, authCalls } = await createHarness();
  const input = { fullName: "Visitor", phone: "61999999999", role: "guest" };
  await invites.createPreRegister(input);
  await assert.rejects(invites.createPreRegister(input), { code: "invite-already-exists" });
  assert.equal(authCalls.length, 1);
});

test("another UID cannot claim the guest and username collisions preserve pending data", async () => {
  const { invites, users, documents } = await createHarness();
  const invite = await invites.createPreRegister({ fullName: "Visitor", phone: "61999999999", role: "guest" });
  await assert.rejects(users.createUserBaseData({ uid: "another-uid", preRegister: invite, username: "visitor", authEmail: "visitor@parads.local" }));
  documents.set("usernames/visitor", { uid: "someone-else" });
  await assert.rejects(users.createUserBaseData({ uid: invite.userId, preRegister: invite, username: "visitor", authEmail: "visitor@parads.local" }));
  assert.equal(documents.get("pre_registered_users/5561999999999").claimed, false);
  assert.equal(documents.get(`users/${invite.userId}`).firstAccessPending, true);
});

test("changing an old pending invitation to guest provisions its account", async () => {
  const { invites, documents } = await createHarness();
  const invite = await invites.createPreRegister({ fullName: "Visitor", phone: "61999999999", role: "member" });
  assert.equal(invite.userId, null);
  await invites.updatePreRegister(invite.id, { role: "guest", sex: "female" });
  assert.equal(documents.get(`pre_registered_users/${invite.id}`).userId, "guest-auth-uid");
  assert.equal(documents.get("users/guest-auth-uid").sex, "female");
  assert.equal(documents.get("user_stats/guest-auth-uid").matchesPlayed, 0);
});

test("regenerating a guest code also updates pending Auth access", async () => {
  const { invites, documents, authCalls } = await createHarness();
  const invite = await invites.createPreRegister({ fullName: "Visitor", phone: "61999999999", role: "guest" });
  documents.set(`invite_access_codes/${invite.id}`, { code: "654321" });
  await invites.regenerateInviteAccessCode(invite.id);
  assert.equal(authCalls[1].oldCode, "654321");
  assert.equal(authCalls[1].newCode, "123456");
  assert.equal(documents.get(`invite_access_codes/${invite.id}`).code, "123456");
});

test("editing a pending invitation updates its name but preserves the phone and access code", async () => {
  const { invites, documents } = await createHarness();
  const invite = await invites.createPreRegister({ fullName: "Old Name", phone: "61999999999", role: "member" });
  const before = { ...documents.get(`pre_registered_users/${invite.id}`) };
  await invites.updatePreRegister(invite.id, { fullName: "  New Name  ", role: "member", sex: "male" });
  const after = documents.get(`pre_registered_users/${invite.id}`);
  assert.equal(after.fullName, "New Name");
  assert.equal(after.phone, before.phone);
  assert.equal(after.accessCodeHash, before.accessCodeHash);
  assert.equal(after.userId, before.userId);
});

test("editing a registered name syncs public data without touching a custom display name or progression", async () => {
  const { invites, users, documents } = await createHarness();
  const invite = await invites.createPreRegister({ fullName: "Old Name", phone: "61999999999", role: "guest" });
  await users.createUserBaseData({ uid: invite.userId, preRegister: invite, username: "visitor", authEmail: invite.pendingAuthEmail });
  const user = documents.get(`users/${invite.userId}`);
  user.profile.displayName = "Custom";
  user.progression.coins = 44;
  const stats = structuredClone(documents.get(`user_stats/${invite.userId}`));
  const inventory = structuredClone(documents.get(`user_inventory/${invite.userId}`));
  await invites.updatePreRegister(invite.id, { fullName: "New Name", role: "member", sex: "female" });
  const updated = documents.get(`users/${invite.userId}`);
  assert.equal(updated.fullName, "New Name");
  assert.equal(updated.profile.displayName, "Custom");
  assert.equal(updated.username, "visitor");
  assert.equal(updated.progression.coins, 44);
  assert.equal(updated.phone, invite.phone);
  assert.equal(documents.get(`public_profiles/${invite.userId}`).fullName, "New Name");
  assert.deepEqual(documents.get(`user_stats/${invite.userId}`), stats);
  assert.deepEqual(documents.get(`user_inventory/${invite.userId}`), inventory);
});

test("editing an uncustomized guest name also corrects its default display name", async () => {
  const { invites, documents } = await createHarness();
  const invite = await invites.createPreRegister({ fullName: "Old Name", phone: "61999999999", role: "guest" });
  const oldProfile = documents.get(`users/${invite.userId}`).profile;
  await invites.updatePreRegister(invite.id, { fullName: "New Name", role: "guest", sex: "male" });
  const updated = documents.get(`users/${invite.userId}`);
  assert.deepEqual(updated.profile, { ...oldProfile, displayName: "New Name" });
  assert.equal(documents.get(`public_profiles/${invite.userId}`).profile.displayName, "New Name");
});

test("renaming while converting a pending invitation to guest uses the new name throughout", async () => {
  const { invites, documents } = await createHarness();
  const invite = await invites.createPreRegister({ fullName: "Old Name", phone: "61999999999", role: "member" });
  await invites.updatePreRegister(invite.id, { fullName: "New Name", role: "guest", sex: "male" });
  const updated = documents.get(`pre_registered_users/${invite.id}`);
  assert.equal(updated.fullName, "New Name");
  assert.equal(documents.get(`users/${updated.userId}`).fullName, "New Name");
  assert.equal(documents.get(`public_profiles/${updated.userId}`).fullName, "New Name");
});

test("blank names are rejected before changing an invitation", async () => {
  const { invites, documents } = await createHarness();
  const invite = await invites.createPreRegister({ fullName: "Original", phone: "61999999999", role: "member" });
  await assert.rejects(invites.updatePreRegister(invite.id, { fullName: "   ", role: "member", sex: "male" }));
  assert.equal(documents.get(`pre_registered_users/${invite.id}`).fullName, "Original");
});
