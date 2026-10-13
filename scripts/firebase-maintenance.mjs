import { createRequire } from "node:module";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const project = "parads-app-26f23";
const collections = [
  "users", "public_profiles", "usernames", "user_stats", "user_inventory",
  "user_showcase", "pre_registered_users", "invite_access_codes",
  "volley_lists", "volley_reports", "app_metrics", "feed_posts",
];

async function firebaseToken() {
  const cache = join(process.env.LOCALAPPDATA, "npm-cache", "_npx");
  const require = createRequire(import.meta.url);
  for (const directory of await readdir(cache)) {
    const entry = join(cache, directory, "node_modules", "firebase-tools", "lib", "auth.js");
    let auth;
    try { auth = require(entry); } catch { continue; }
    const account = auth.getGlobalDefaultAccount();
    if (!account?.tokens?.refresh_token) continue;
    const tokens = await auth.getAccessToken(account.tokens.refresh_token, [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/firebase",
    ]);
    return tokens.access_token;
  }
  throw new Error("Firebase CLI login not found. Run npx firebase-tools login.");
}

const token = await firebaseToken();
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data.error?.message || "Firebase request failed"}`);
  return data;
}

function decode(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields);
  return value;
}
function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}
async function listCollection(collection) {
  const documents = [];
  let pageToken;
  do {
    const url = new URL(`${base}/${collection}`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const result = await request(url);
    documents.push(...result.documents || []);
    pageToken = result.nextPageToken;
  } while (pageToken);
  return documents;
}
async function listAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const url = new URL(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet`);
    url.searchParams.set("maxResults", "1000");
    if (pageToken) url.searchParams.set("nextPageToken", pageToken);
    const result = await request(url);
    users.push(...(result.users || []).map(({ localId, email, createdAt, lastLoginAt }) => ({
      uid: localId, email, createdAt, lastLoginAt,
    })));
    pageToken = result.nextPageToken;
  } while (pageToken);
  return users;
}

const args = process.argv.slice(2);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirectory = resolve(".firebase-maintenance", timestamp);

const orphanIds = args[0] === "--remove-orphan-profiles" ? [...new Set(args.slice(1))] : [];
if (args.length && !(args.length === 1 && args[0] === "--apply-tests")
  && !(orphanIds.length && orphanIds.every((id) => /^[A-Za-z0-9_-]+$/.test(id)))) {
  throw new Error("Use no arguments for audit, --apply-tests, or --remove-orphan-profiles followed by explicit profile IDs. Accounts and invites are never deleted.");
}
const data = Object.fromEntries(await Promise.all(collections.map(async (collection) => [collection, await listCollection(collection)])));
const authUsers = await listAuthUsers();
await mkdir(outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, "snapshot.json"), JSON.stringify({ project, takenAt: new Date().toISOString(), data, authUsers }, null, 2), { mode: 0o600 });

const rows = (collection) => data[collection].map((document) => ({
  id: document.name.split("/").at(-1), ...decodeFields(document.fields),
}));
const users = rows("users");
const publicProfiles = rows("public_profiles");
const summary = {
  project,
  counts: Object.fromEntries(collections.map((collection) => [collection, data[collection].length])),
  authCount: authUsers.length,
  users: users.map((user) => ({
    id: user.id, name: user.fullName, displayName: user.profile?.displayName,
    username: user.username, role: user.role,
    phoneLast4: String(user.phone || "").slice(-4),
    firstAccessPending: Boolean(user.firstAccessPending), createdAt: user.createdAt,
  })),
  invites: rows("pre_registered_users").map((invite) => ({
    id: invite.id, name: invite.fullName, role: invite.role, claimed: invite.claimed,
    userId: invite.userId, createdAt: invite.createdAt,
  })),
  lists: rows("volley_lists").map((list) => ({
    id: list.id, date: list.date, status: list.status,
    games: list.games?.length || 0,
    players: (list.matchPlayers || []).map((player) => ({
      name: player.displayName, userId: player.userId, entryId: player.entryId,
    })),
    mockCount: (list.matchPlayers || []).filter((player) => player.entryId?.startsWith("mock_")).length,
  })),
  reports: rows("volley_reports").map((report) => ({ id: report.id, date: report.date, summary: report.summary })),
  metrics: rows("app_metrics"),
  feed: rows("feed_posts").map((post) => ({ id: post.id, type: post.type, reportId: post.reportId, date: post.payload?.date })),
  orphanPublicProfiles: publicProfiles.filter((profile) => !users.some((user) => user.id === profile.id)).map((profile) => ({ id: profile.id, name: profile.fullName, username: profile.username })),
  orphanAuthUsers: authUsers.filter((account) => !users.some((user) => user.id === account.uid)),
};
await writeFile(join(outputDirectory, "summary.json"), JSON.stringify(summary, null, 2), { mode: 0o600 });

const testCollections = ["volley_lists", "volley_reports", "app_metrics", "feed_posts"];
const isUnlinkedProfile = (id) => !users.some((user) => user.id === id)
  && !authUsers.some((account) => account.uid === id)
  && !rows("pre_registered_users").some((invite) => invite.userId === id)
  && !["user_inventory", "user_stats", "user_showcase"].some((collection) => rows(collection).some((item) => item.id === id));
if (orphanIds.some((id) => !isUnlinkedProfile(id))) {
  throw new Error("At least one requested profile has a linked account or user data; deletion refused.");
}
const deletionCandidates = orphanIds.length
  ? data.public_profiles.filter((document) => orphanIds.includes(document.name.split("/").at(-1)))
  : [
  ...testCollections.flatMap((collection) => data[collection]),
  ...data.user_stats.filter((document) => document.name.split("/").at(-1).startsWith("mock_")),
];
const plan = {
  project,
  preserve: ["users", "public_profiles", "usernames", "user_inventory", "user_showcase", "pre_registered_users", "invite_access_codes"],
  deleteDocuments: deletionCandidates.map((document) => ({ name: document.name, updateTime: document.updateTime })),
  deleteCounts: Object.fromEntries((orphanIds.length ? ["public_profiles"] : [...testCollections, "user_stats"]).map((collection) => [
    collection, deletionCandidates.filter((document) => document.name.split("/").at(-2) === collection).length,
  ])),
};
await writeFile(join(outputDirectory, "cleanup-plan.json"), JSON.stringify(plan, null, 2), { mode: 0o600 });

if (args[0] === "--apply-tests" || orphanIds.length) {
  if (deletionCandidates.length > 450) throw new Error("More than 450 records: split and review the plan before deletion.");
  if (deletionCandidates.some((document) => {
    const collection = document.name.split("/").at(-2);
    if (orphanIds.length) {
      const id = document.name.split("/").at(-1);
      return collection !== "public_profiles" || !orphanIds.includes(id) || !isUnlinkedProfile(id);
    }
    return !testCollections.includes(collection)
      && !(collection === "user_stats" && document.name.split("/").at(-1).startsWith("mock_"));
  })) throw new Error("Plan contains a protected record.");

  // The backup is saved before the atomic commit; modified records cause the whole commit to fail.
  if (deletionCandidates.length) {
    await request(`${base}:commit`, {
      method: "POST",
      body: JSON.stringify({ writes: deletionCandidates.map((document) => ({
        delete: document.name,
        currentDocument: { updateTime: document.updateTime },
      })) }),
    });
  }
  const after = Object.fromEntries(await Promise.all(collections.map(async (collection) => [collection, await listCollection(collection)])));
  for (const collection of plan.preserve) {
    const remainingNames = new Set(after[collection].map((document) => document.name));
    const deletedNames = new Set(deletionCandidates.map((document) => document.name));
    if (data[collection].some((document) => !deletedNames.has(document.name) && !remainingNames.has(document.name))) {
      throw new Error(`Verification failed: missing protected record in ${collection}. Check the backup.`);
    }
  }
  const receipt = {
    project, outputDirectory, deleted: plan.deleteCounts,
    remaining: Object.fromEntries(collections.map((collection) => [collection, after[collection].length])),
    remainingMockStats: after.user_stats.filter((document) => document.name.split("/").at(-1).startsWith("mock_")).length,
  };
  await writeFile(join(outputDirectory, "cleanup-receipt.json"), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
} else {
  console.log(JSON.stringify({ outputDirectory, ...summary, proposedCleanup: plan.deleteCounts }, null, 2));
}
