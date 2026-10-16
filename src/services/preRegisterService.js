import {
  collection,
  doc,
  getDocs,
  getDoc,
  runTransaction,
  writeBatch,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { buildInitialUserDocuments } from "./userDefaults";
import { provisionGuestAccount, replacePendingGuestCode } from "./guestAccountService";
import {
  generateAccessCode,
  generateAccessCodeSalt,
  hashAccessCode,
} from "./accessCodeService";

const COLLECTION_NAME = "pre_registered_users";

export async function getPreRegisters() {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(q);

  const invites = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
  const codes = await getDocs(collection(db, "invite_access_codes"));
  const codesById = new Map(codes.docs.map((item) => [item.id, item.data().code]));
  return invites.map((invite) => ({
    ...invite,
    temporaryCode: invite.claimed ? null : codesById.get(invite.id) || null,
  }));
}

export async function createPreRegister({
  fullName,
  phone,
  type = "member",
  role = "member",
  sex = "male",
}) {
  const accountRole = role || type || "member";
  const phoneWithCountry = `55${phone}`;
  const temporaryCode = generateAccessCode();
  const accessCodeSalt = generateAccessCodeSalt();
  const accessCodeHash = await hashAccessCode(temporaryCode, accessCodeSalt);
  const guestAuthEmail = accountRole === "guest"
    ? `guest.${generateAccessCodeSalt()}@parads.local`
    : null;

  const payload = {
    fullName: fullName.trim(),
    phone: phoneWithCountry,

    type: accountRole,
    role: accountRole,
    sex,

    enabled: true,
    claimed: false,
    userId: null,
    accessCodeHash,
    accessCodeSalt,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const saveInvite = (guestUid = null) => runTransaction(db, async (transaction) => {
    const inviteRef = doc(db, COLLECTION_NAME, phoneWithCountry);
    const existing = await transaction.get(inviteRef);
    if (existing.exists()) {
      const error = new Error("Já existe um convite para esse celular.");
      error.code = "invite-already-exists";
      throw error;
    }
    const nextPayload = guestUid
      ? { ...payload, userId: guestUid, pendingAuthEmail: guestAuthEmail }
      : payload;
    transaction.set(inviteRef, nextPayload);
    transaction.set(doc(db, "invite_access_codes", phoneWithCountry), {
      code: temporaryCode,
      updatedAt: serverTimestamp(),
    });
    let user = null;
    if (guestUid) {
      const initial = buildInitialUserDocuments({
        fullName: payload.fullName, phone: phoneWithCountry, role: accountRole, sex,
        authEmail: guestAuthEmail, firstAccessPending: true,
      });
      transaction.set(doc(db, "users", guestUid), initial.user);
      transaction.set(doc(db, "public_profiles", guestUid), initial.publicProfile);
      transaction.set(doc(db, "user_stats", guestUid), initial.stats);
      transaction.set(doc(db, "user_inventory", guestUid), initial.inventory);
      transaction.set(doc(db, "user_showcase", guestUid), initial.showcase);
      user = { id: guestUid, ...initial.user };
    }
    return { id: phoneWithCountry, ...nextPayload, temporaryCode, user };
  });

  if (accountRole === "guest") {
    const existing = await getDoc(doc(db, COLLECTION_NAME, phoneWithCountry));
    if (existing.exists()) {
      const error = new Error("Já existe um convite para esse celular.");
      error.code = "invite-already-exists";
      throw error;
    }
    return provisionGuestAccount({
      email: guestAuthEmail, code: temporaryCode,
      save: saveInvite,
    });
  }
  return saveInvite();
}

export async function deletePreRegister(id) {
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTION_NAME, id));
  batch.delete(doc(db, "invite_access_codes", id));
  await batch.commit();
}

export async function updatePreRegister(id, { fullName, role, sex }) {
  const cleanName = typeof fullName === "string" ? fullName.trim() : undefined;
  if (fullName !== undefined && !cleanName) throw new Error("Informe o nome completo.");
  if (!["admin", "member", "guest"].includes(role)
    || !["male", "female"].includes(sex)) throw new Error("Tipo ou sexo inválido.");
  const existingInvite = await getDoc(doc(db, COLLECTION_NAME, id));
  if (!existingInvite.exists()) throw new Error("Convite não encontrado.");
  if (role === "guest" && !existingInvite.data().claimed && !existingInvite.data().userId) {
    return provisionExistingGuestInvite(id, existingInvite.data(), sex, cleanName);
  }
  return runTransaction(db, async (transaction) => {
    const inviteRef = doc(db, COLLECTION_NAME, id);
    const inviteSnap = await transaction.get(inviteRef);
    if (!inviteSnap.exists()) throw new Error("Convite não encontrado.");
    const uid = inviteSnap.data().userId;
    const userRef = uid ? doc(db, "users", uid) : null;
    const userSnap = userRef ? await transaction.get(userRef) : null;
    const changes = { role, type: role, sex, updatedAt: serverTimestamp() };
    if (cleanName !== undefined) changes.fullName = cleanName;
    transaction.update(inviteRef, changes);
    if (userSnap?.exists()) {
      const userChanges = { ...changes };
      const user = userSnap.data();
      if (cleanName !== undefined && (!user.profile?.displayName || user.profile.displayName === user.fullName)) {
        userChanges.profile = { ...user.profile, displayName: cleanName };
      }
      transaction.update(userRef, userChanges);
      transaction.set(doc(db, "public_profiles", uid), userChanges, { merge: true });
    }
  });
}

async function provisionExistingGuestInvite(id, invite, sex, fullName) {
  const savedCode = await getDoc(doc(db, "invite_access_codes", id));
  const code = savedCode.data()?.code || generateAccessCode();
  const salt = savedCode.exists() ? invite.accessCodeSalt : generateAccessCodeSalt();
  const hash = savedCode.exists() ? invite.accessCodeHash : await hashAccessCode(code, salt);
  const email = `guest.${generateAccessCodeSalt()}@parads.local`;
  return provisionGuestAccount({ email, code, save: (uid) => runTransaction(db, async (transaction) => {
    const inviteRef = doc(db, COLLECTION_NAME, id);
    const current = await transaction.get(inviteRef);
    if (!current.exists() || current.data().claimed || current.data().userId) {
      throw new Error("O convite foi alterado. Recarregue a lista.");
    }
    const initial = buildInitialUserDocuments({
      fullName: fullName ?? current.data().fullName, phone: current.data().phone,
      role: "guest", sex, authEmail: email, firstAccessPending: true,
    });
    transaction.update(inviteRef, {
      fullName: initial.user.fullName,
      role: "guest", type: "guest", sex, userId: uid, pendingAuthEmail: email,
      accessCodeSalt: salt, accessCodeHash: hash, updatedAt: serverTimestamp(),
    });
    transaction.set(doc(db, "invite_access_codes", id), { code, updatedAt: serverTimestamp() });
    transaction.set(doc(db, "users", uid), initial.user);
    transaction.set(doc(db, "public_profiles", uid), initial.publicProfile);
    transaction.set(doc(db, "user_stats", uid), initial.stats);
    transaction.set(doc(db, "user_inventory", uid), initial.inventory);
    transaction.set(doc(db, "user_showcase", uid), initial.showcase);
  }) });
}

export async function regenerateInviteAccessCode(id) {
  const inviteRef = doc(db, COLLECTION_NAME, id);
  const invite = await getDoc(inviteRef);
  if (!invite.exists() || invite.data().claimed) throw new Error("Convite indisponível.");
  const code = generateAccessCode();
  const salt = generateAccessCodeSalt();
  const hash = await hashAccessCode(code, salt);
  const saveCode = () => runTransaction(db, async (transaction) => {
    const current = await transaction.get(inviteRef);
    if (!current.exists() || current.data().claimed) throw new Error("Convite indisponível.");
    transaction.update(inviteRef, {
      accessCodeSalt: salt, accessCodeHash: hash, updatedAt: serverTimestamp(),
    });
    transaction.set(doc(db, "invite_access_codes", id), { code, updatedAt: serverTimestamp() });
  });
  if (invite.data().pendingAuthEmail) {
    const savedCode = await getDoc(doc(db, "invite_access_codes", id));
    if (!savedCode.exists()) throw new Error("Código anterior não encontrado.");
    await replacePendingGuestCode({
      email: invite.data().pendingAuthEmail, oldCode: savedCode.data().code,
      newCode: code, save: saveCode,
    });
  } else {
    await saveCode();
  }
  return code;
}
