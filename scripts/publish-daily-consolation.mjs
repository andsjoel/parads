import { loadEnv } from "vite";
import { getAdminServices } from "../server/firebaseAdmin.js";
import { buildDailyConsolationPost, dailyConsolationPostId } from "../src/utils/dailyConsolation.js";
import { isTimelineDate } from "../src/utils/matchTimeline.js";

const args = process.argv.slice(2);
const date = args.find((arg) => arg.startsWith("--date="))?.slice(7);
const project = args.find((arg) => arg.startsWith("--project="))?.slice(10);
const publish = args.includes("--publish");
if (!isTimelineDate(date) || !project || args.length !== (publish ? 3 : 2)
  || args.some((arg) => arg !== "--publish" && !arg.startsWith("--date=") && !arg.startsWith("--project="))) {
  throw Error("Use --date=YYYY-MM-DD --project=PROJECT [--publish]. Default: read-only preview.");
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.PARADS_TEST_MODE) {
  throw Error("Production publication cannot run in a test/emulator environment.");
}
Object.assign(process.env, loadEnv("development", process.cwd(), ["FIREBASE_ADMIN_"]));
if (process.env.FIREBASE_ADMIN_PROJECT_ID !== project) throw Error("Project does not match configured credentials.");
const { db } = getAdminServices();
try {
  const found = await db.collection("volley_lists").where("date", "==", date).limit(2).get();
  if (found.size !== 1) throw Error("Expected exactly one list for this date.");
  const list = found.docs[0];
  const result = await db.runTransaction(async (transaction) => {
    const postRef = db.doc(`feed_posts/${dailyConsolationPostId(list.id)}`);
    const [current, existing] = await Promise.all([transaction.get(list.ref), transaction.get(postRef)]);
    if (!current.exists || current.data().status !== "closed" || current.data().date !== date) {
      throw Error("Only an already closed list can be published manually.");
    }
    const post = buildDailyConsolationPost(current.data(), list.id);
    if (!post) return { status: "no-eligible-players", recipients: [] };
    if (existing.exists && JSON.stringify(existing.data().payload) !== JSON.stringify(post.payload)) {
      throw Error("Existing post differs; it will not be overwritten.");
    }
    if (publish && !existing.exists) {
      const { FieldValue } = await import("firebase-admin/firestore");
      transaction.create(postRef, { ...post, createdAt: FieldValue.serverTimestamp() });
    }
    const names = new Map((current.data().matchPlayers || []).map((p) => [p.userId, p.displayName]));
    return { status: existing.exists ? "already-published" : publish ? "published" : "preview-only", date,
      recipients: Object.entries(post.payload.recipients).map(([uid, value]) => ({ name: names.get(uid), ...value })),
      totalCoinsAvailable: Object.values(post.payload.recipients).reduce((sum, value) => sum + value.reward, 0) };
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await db.terminate();
}
