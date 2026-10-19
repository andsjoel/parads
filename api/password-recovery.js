import process from "node:process";
import { createHmac } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "../server/firebaseAdmin.js";
import { createPasswordRecovery, createRecoveryStore, RecoveryError, validateRecoveryPayload } from "../server/passwordRecovery.js";
import { ApiError, bearerToken, createLocalRequestGate, readJsonBody, requestIp } from "../server/apiProtection.js";
import { createSharedRequestLimiter } from "../server/requestLimits.js";

export function createRecoveryHandler({
  services = getAdminServices, secret = () => process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  enabled = () => process.env.PARADS_PASSWORD_RECOVERY_DISABLED !== "true" && process.env.PARADS_API_OPERATIONS_PAUSED !== "true",
  isVercel = () => process.env.VERCEL === "1", now = Date.now,
  recovery = ({ auth, db }) => createPasswordRecovery({ auth, store: createRecoveryStore(db, FieldValue), now }),
} = {}) {
  let runtime;
  const localGate = createLocalRequestGate({ minuteLimit: 120, ipLimit: 60, now });
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const respond = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return respond(405, { error: "Método não permitido." }); }
    try {
      const token = bearerToken(req);
      const body = await readJsonBody(req, 2048);
      validateRecoveryPayload(body);
      if (!enabled()) throw new ApiError(503, "Recuperação temporariamente indisponível. Procure o ADM.");
      const ip = requestIp(req, isVercel());
      localGate(ip);
      if (!runtime) {
        const value = secret();
        if (typeof value !== "string" || value.length < 32) throw new ApiError(503, "Serviço de recuperação indisponível.");
        const admin = services();
        const key = createHmac("sha256", value).update("parads/password-recovery/limits/v1").digest();
        runtime = { auth: admin.auth, service: recovery(admin), limit: createSharedRequestLimiter({
          db: admin.db, key, namespace: "password_recovery", minuteLimit: 120, dayLimit: 300, ipLimit: 60, now,
        }) };
      }
      // Budget before token verification (including its Auth revocation lookup).
      await runtime.limit(ip);
      let claims;
      try { claims = await runtime.auth.verifyIdToken(token, true); }
      catch { throw new ApiError(401, "Sua sessão expirou. Entre novamente."); }
      if (!claims?.uid || !Number.isFinite(claims.auth_time)) throw new ApiError(401, "Sua sessão expirou. Entre novamente.");
      if (body.action === "reset") return respond(200, await runtime.service.reset(claims.uid, body.inviteId, claims.auth_time));
      return respond(200, await runtime.service.complete(claims, body.password));
    } catch (error) {
      const known = error instanceof ApiError || error instanceof RecoveryError;
      if (known && error.status === 429) res.setHeader("Retry-After", String(error.retryAfter || 60));
      return respond(known ? error.status : 503, { error: known ? error.message : "Não foi possível concluir a redefinição. Tente novamente." });
    }
  };
}

export default createRecoveryHandler();
