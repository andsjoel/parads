import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { verifyAccessCode } from "../utils/accessCode";
import { normalizeBrazilPhone } from "../utils/phone";

export async function findFirstAccessInvite(phone) {
  const normalizedPhone = normalizeBrazilPhone(phone);
  if (!normalizedPhone) throw new Error("Celular invalido.");

  const localPhone = normalizedPhone.slice(2);
  let snapshot = null;

  for (const documentId of [normalizedPhone, localPhone]) {
    const candidate = await getDoc(
      doc(db, "pre_registered_users", documentId),
    );

    if (candidate.exists()) {
      snapshot = candidate;
      break;
    }
  }

  if (!snapshot) {
    for (const phoneValue of [normalizedPhone, localPhone, Number(normalizedPhone), Number(localPhone)]) {
      try {
        const result = await getDocs(
          query(
            collection(db, "pre_registered_users"),
            where("phone", "==", phoneValue),
            limit(1),
          ),
        );

        if (!result.empty) {
          snapshot = result.docs[0];
          break;
        }
      } catch (error) {
        if (error.code !== "permission-denied") throw error;
      }
    }
  }

  if (!snapshot) throw new Error("Convite nao encontrado.");

  const invite = snapshot.data();
  if (!invite.enabled || invite.claimed) {
    throw new Error("Convite indisponivel.");
  }

  return { id: snapshot.id, ...invite };
}

export async function validateFirstAccessCode(invite, code) {
  return verifyAccessCode(
    code,
    invite.accessCodeSalt,
    invite.accessCodeHash,
  );
}
