import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { getPromotionalMissionStates, promotionalMissions } from "../data/promotionalMissions";

export async function claimPromotionalMission(uid, missionId) {
  if (!uid || !promotionalMissions.some((mission) => mission.id === missionId)) {
    throw new Error("Missão inválida.");
  }
  const userRef = doc(db, "users", uid);
  const statsRef = doc(db, "user_stats", uid);
  const inventoryRef = doc(db, "user_inventory", uid);
  const publicProfileRef = doc(db, "public_profiles", uid);
  return runTransaction(db, async (transaction) => {
    const [userSnap, statsSnap, inventorySnap] = await Promise.all([
      transaction.get(userRef), transaction.get(statsRef), transaction.get(inventoryRef),
    ]);
    if (!userSnap.exists() || !statsSnap.exists() || !inventorySnap.exists()) {
      throw new Error("Não foi possível carregar os dados da missão.");
    }
    const user = userSnap.data();
    const stats = statsSnap.data();
    const mission = getPromotionalMissionStates(user, inventorySnap.data(), stats)
      .find((item) => item.id === missionId);
    const coins = user.progression?.coins || 0;
    if (mission.claimed) return { coins, stats, reward: 0 };
    if (!mission.claimable) throw new Error("Conclua o objetivo antes de resgatar.");
    const nextCoins = coins + mission.reward;
    const claimedPromotionalMissionIds = [...(stats.claimedPromotionalMissionIds || []), missionId];
    transaction.update(userRef, { "progression.coins": nextCoins, updatedAt: serverTimestamp() });
    transaction.set(publicProfileRef, { progression: { coins: nextCoins }, updatedAt: serverTimestamp() }, { merge: true });
    transaction.update(statsRef, { claimedPromotionalMissionIds, updatedAt: serverTimestamp() });
    return { coins: nextCoins, stats: { ...stats, claimedPromotionalMissionIds }, reward: mission.reward };
  });
}
