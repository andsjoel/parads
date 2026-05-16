import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

export async function unlockAchievement(uid, achievementId, level = 1) {
  if (!uid || !achievementId) return null;

  const inventoryRef = doc(db, "user_inventory", uid);
  const inventorySnap = await getDoc(inventoryRef);

  if (!inventorySnap.exists()) return null;

  const inventory = inventorySnap.data();
  const achievements = Array.isArray(inventory.achievements)
    ? inventory.achievements
    : [];

  const alreadyUnlocked = achievements.some(
    (achievement) => achievement.id === achievementId,
  );

  if (alreadyUnlocked) return null;

  const achievementPayload = {
    id: achievementId,
    level,
    unlockedAt: new Date(),
  };

  await updateDoc(inventoryRef, {
    achievements: arrayUnion(achievementPayload),
    updatedAt: serverTimestamp(),
  });

  return achievementPayload;
}