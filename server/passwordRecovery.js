import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

export class RecoveryError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const hashPassword = (password) => createHash("sha256").update(password).digest("hex");

export function createPasswordRecovery({ auth, store, now = Date.now, generatePassword = () => String(randomInt(100_000_000)).padStart(8, "0"), wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  async function waitForNewLogin(second) {
    const delay = (second + 1) * 1000 - now() + 100;
    if (delay > 0) await wait(delay);
  }

  return {
    async reset(actorUid, inviteId) {
      if (typeof inviteId !== "string" || !/^\d{10,15}$/.test(inviteId)) {
        throw new RecoveryError(400, "Convite inválido.");
      }
      const password = generatePassword();
      const resetId = randomUUID();
      const invalidBefore = Math.floor(now() / 1000);
      const context = await store.prepareReset({ actorUid, inviteId, resetId, invalidBefore, temporaryHash: hashPassword(password), now: now() });
      let passwordUpdated = false;
      try {
        await auth.updateUser(context.uid, { password });
        passwordUpdated = true;
        await auth.revokeRefreshTokens(context.uid);
        const readyAt = Math.floor(now() / 1000);
        await store.markReady(context.uid, resetId, readyAt);
        await waitForNewLogin(readyAt);
        return { temporaryPassword: password, fullName: context.fullName };
      } catch (error) {
        await store.resetFailed(context, resetId, passwordUpdated).catch(() => {});
        throw error;
      }
    },

    async complete(claims, password) {
      if (typeof password !== "string" || !/^\d{8}$/.test(password)) {
        throw new RecoveryError(400, "A nova senha deve ter 8 números.");
      }
      const resetId = await store.prepareCompletion({ uid: claims.uid, authTime: claims.auth_time, temporaryHash: hashPassword(password) });
      try {
        await auth.updateUser(claims.uid, { password });
        await auth.revokeRefreshTokens(claims.uid);
        const invalidBefore = Math.floor(now() / 1000);
        await store.complete(claims.uid, resetId, invalidBefore);
        await waitForNewLogin(invalidBefore);
        return { completed: true };
      } catch (error) {
        await store.completionFailed(claims.uid, resetId).catch(() => {});
        throw error;
      }
    },
  };
}

export function createRecoveryStore(db, fieldValue) {
  const security = (uid) => db.collection("account_security").doc(uid);
  const audit = (id) => db.collection("password_reset_audit").doc(id);
  return {
    prepareReset: ({ actorUid, inviteId, resetId, invalidBefore, temporaryHash, now }) => db.runTransaction(async (transaction) => {
      const actor = await transaction.get(db.collection("users").doc(actorUid));
      const actorSecurity = await transaction.get(security(actorUid));
      if (actor.data()?.role !== "admin" || actorSecurity.data()?.passwordChangeRequired) {
        throw new RecoveryError(403, "Apenas administradores podem redefinir senhas.");
      }
      const invite = await transaction.get(db.collection("pre_registered_users").doc(inviteId));
      if (!invite.data()?.claimed || !invite.data()?.userId) {
        throw new RecoveryError(400, "Essa conta ainda não concluiu o primeiro acesso.");
      }
      const uid = invite.data().userId;
      if (uid === actorUid) throw new RecoveryError(400, "Peça a outro administrador para redefinir sua senha.");
      const user = await transaction.get(db.collection("users").doc(uid));
      const previous = await transaction.get(security(uid));
      if (!user.exists || user.data().phone !== invite.data().phone) throw new RecoveryError(404, "Conta não encontrada para esse convite.");
      if (now - (previous.data()?.requestedAt?.toMillis() || 0) < 60_000) {
        throw new RecoveryError(429, "Aguarde um minuto antes de gerar outra senha.");
      }
      transaction.set(security(uid), {
        passwordChangeRequired: true, resetState: "preparing", resetId, invalidBefore,
        requestedAt: fieldValue.serverTimestamp(), requestedBy: actorUid,
      }, { merge: true });
      transaction.set(audit(resetId), {
        uid, actorUid, inviteId, temporaryHash, status: "preparing",
        createdAt: fieldValue.serverTimestamp(),
      });
      return { uid, fullName: user.data().fullName, previous: previous.exists ? previous.data() : null };
    }),
    async markReady(uid, resetId, invalidBefore) {
      const batch = db.batch();
      batch.update(security(uid), { resetState: "ready", invalidBefore });
      batch.update(audit(resetId), { status: "ready", readyAt: fieldValue.serverTimestamp() });
      await batch.commit();
    },
    async resetFailed(context, resetId, passwordUpdated) {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(security(context.uid));
        if (current.data()?.resetId !== resetId) return;
        if (passwordUpdated) transaction.update(security(context.uid), { resetState: "failed" });
        else if (context.previous) transaction.set(security(context.uid), context.previous);
        else transaction.delete(security(context.uid));
        transaction.update(audit(resetId), { status: "failed", temporaryHash: fieldValue.delete() });
      });
    },
    prepareCompletion: ({ uid, authTime, temporaryHash }) => db.runTransaction(async (transaction) => {
      const current = await transaction.get(security(uid));
      const state = current.data();
      if (!state?.passwordChangeRequired || state.resetState !== "ready") {
        throw new RecoveryError(409, "Não há uma redefinição disponível. Entre novamente ou procure o admin.");
      }
      if (!authTime || authTime <= state.invalidBefore) throw new RecoveryError(401, "Entre novamente com a senha temporária.");
      const reset = await transaction.get(audit(state.resetId));
      const previousHash = reset.data()?.temporaryHash;
      if (previousHash && timingSafeEqual(Buffer.from(previousHash, "hex"), Buffer.from(temporaryHash, "hex"))) {
        throw new RecoveryError(400, "Escolha uma senha diferente da temporária.");
      }
      transaction.update(security(uid), { resetState: "updating" });
      return state.resetId;
    }),
    async complete(uid, resetId, invalidBefore) {
      const batch = db.batch();
      batch.update(security(uid), {
        passwordChangeRequired: false, resetState: "completed", invalidBefore,
        completedAt: fieldValue.serverTimestamp(),
      });
      batch.update(audit(resetId), { status: "completed", completedAt: fieldValue.serverTimestamp(), temporaryHash: fieldValue.delete() });
      await batch.commit();
    },
    async completionFailed(uid, resetId) {
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(security(uid));
        if (current.data()?.resetId === resetId && current.data()?.resetState === "updating") {
          transaction.update(security(uid), { resetState: "ready" });
        }
      });
    },
  };
}
