import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { dailyConsolationPostId, getDailyConsolationReward, DAILY_CONSOLATION_VERSION } from "../utils/dailyConsolation";

export async function claimDailyConsolation(listId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw Error("Entre na sua conta para resgatar.");
  const postRef = doc(db, "feed_posts", dailyConsolationPostId(listId));
  const userRef = doc(db, "users", uid);
  const statsRef = doc(db, "user_stats", uid);
  return runTransaction(db, async (transaction) => {
    const [postSnap, userSnap, statsSnap] = await Promise.all([
      transaction.get(postRef), transaction.get(userRef), transaction.get(statsRef),
    ]);
    const post = postSnap.exists() ? postSnap.data() : null;
    const award = post?.payload?.recipients?.[uid];
    if (!userSnap.exists() || !post || post.type !== "daily_consolation"
      || post.payload.version !== DAILY_CONSOLATION_VERSION || post.payload.listId !== listId
      || !award || !award.reward || award.reward !== getDailyConsolationReward(award.games, award.losses)) {
      throw Error("Recompensa não disponível para esta conta.");
    }
    const user = userSnap.data(), stats = statsSnap.exists() ? statsSnap.data() : {};
    const coins = user.progression?.coins || 0;
    if (stats.dailyConsolationClaims?.[listId]) return { coins, stats, reward: 0 };
    const claims = { ...stats.dailyConsolationClaims, [listId]: {
      date: post.payload.date, reward: award.reward, claimedAt: serverTimestamp(),
    } };
    transaction.update(userRef, { "progression.coins": coins + award.reward, updatedAt: serverTimestamp() });
    transaction.set(doc(db, "public_profiles", uid), {
      progression: { coins: coins + award.reward }, updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(statsRef, { dailyConsolationClaims: claims, updatedAt: serverTimestamp() }, { merge: true });
    return { coins: coins + award.reward, stats: { ...stats, dailyConsolationClaims: claims }, reward: award.reward };
  });
}
