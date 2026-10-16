import { doc, serverTimestamp, runTransaction } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { getPersonalizationProgress } from "../data/promotionalMissions";

export async function updateUserProfile(uid, profile) {
  const userRef = doc(db, "users", uid);
  const publicProfileRef = doc(db, "public_profiles", uid);
  return runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("Perfil não encontrado.");
    const promotionalProgress = getPersonalizationProgress(userSnap.data(), profile);
    transaction.update(userRef, { profile, promotionalProgress, updatedAt: serverTimestamp() });
    transaction.set(publicProfileRef, { profile, updatedAt: serverTimestamp() }, { merge: true });
    return { promotionalProgress };
  });
}
