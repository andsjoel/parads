import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { db } from "../firebase/firebase";
import {
  getClaimableMissions,
  getPendingSequenceRewards,
  getClaimedSequenceRewardAmount,
} from "../data/profileMissions";

export async function claimProfileMissionRewards(uid, category) {
  if (!category) throw new Error("Categoria de missao invalida.");
  if (!uid) throw new Error("Usuário inválido.");

  const userRef = doc(db, "users", uid);
  const publicProfileRef = doc(db, "public_profiles", uid);
  const statsRef = doc(db, "user_stats", uid);

  return runTransaction(db, async (transaction) => {
    const [userSnap, statsSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(statsRef),
    ]);

    if (!userSnap.exists() || !statsSnap.exists()) {
      throw new Error("Perfil ou estatísticas não encontrados.");
    }

    const user = userSnap.data();
    const stats = statsSnap.data();
    const claimable = getClaimableMissions(stats).filter(
      (item) => item.category === category,
    );
    const sequenceRewards = category === "currentStreak"
      ? getPendingSequenceRewards(stats)
      : [];
    const currentCoins = user.progression?.coins || 0;

    if (!claimable.length && !sequenceRewards.length) {
      return { coins: currentCoins, stats, reward: 0 };
    }

    const reward =
      claimable.reduce((total, item) => total + item.reward, 0) +
      sequenceRewards.reduce((total, item) => total + item.totalReward, 0);
    const claimedMissionIds = [
      ...new Set([
        ...(stats.claimedMissionIds || []),
        ...claimable.map((item) => item.id),
      ]),
    ];

    transaction.update(userRef, {
      "progression.coins": currentCoins + reward,
      updatedAt: serverTimestamp(),
    });
    transaction.set(publicProfileRef, {
      progression: { coins: currentCoins + reward },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    const claimedSequenceMilestoneHits = { ...(stats.claimedSequenceMilestoneHits || {}) };
    const sequencePaymentUpdate = {};
    if (category === "currentStreak") {
      const amounts = { ...(stats.claimedSequenceRewardAmounts || {}) };
      for (const item of sequenceRewards) {
        claimedSequenceMilestoneHits[item.threshold] = stats.sequenceMilestoneHits?.[item.threshold] || 0;
        amounts[item.threshold] = getClaimedSequenceRewardAmount(stats, item.threshold) + item.totalReward;
      }
      sequencePaymentUpdate.claimedSequenceRewardAmounts = amounts;
    }

    transaction.update(statsRef, {
      claimedMissionIds,
      claimedSequenceMilestoneHits,
      ...sequencePaymentUpdate,
      updatedAt: serverTimestamp(),
    });

    return {
      coins: currentCoins + reward,
      stats: {
        ...stats,
        claimedMissionIds,
        claimedSequenceMilestoneHits,
        ...sequencePaymentUpdate,
      },
      reward,
    };
  });
}
