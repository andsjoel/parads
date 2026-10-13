import { FieldValue } from "firebase-admin/firestore";
import { getAdminServices } from "../server/firebaseAdmin.js";
import { createPasswordRecovery, createRecoveryStore, RecoveryError } from "../server/passwordRecovery.js";

async function readBody(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 2048) throw new RecoveryError(413, "Solicitação muito grande.");
  }
  try { return JSON.parse(text || "{}"); }
  catch { throw new RecoveryError(400, "Solicitação inválida."); }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const respond = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return respond(405, { error: "Método não permitido." }); }
  try {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) throw new RecoveryError(401, "Entre novamente para continuar.");
    const { auth, db } = getAdminServices();
    let claims;
    try { claims = await auth.verifyIdToken(authorization.slice(7), true); }
    catch { throw new RecoveryError(401, "Sua sessão expirou. Entre novamente."); }
    const body = await readBody(req);
    const service = createPasswordRecovery({ auth, store: createRecoveryStore(db, FieldValue) });
    if (body.action === "reset") {
      const state = (await db.collection("account_security").doc(claims.uid).get()).data();
      if (state && claims.auth_time <= (state.invalidBefore || 0)) throw new RecoveryError(401, "Entre novamente para continuar.");
      return respond(200, await service.reset(claims.uid, body.inviteId));
    }
    if (body.action === "complete") return respond(200, await service.complete(claims, body.password));
    throw new RecoveryError(400, "Operação inválida.");
  } catch (error) {
    return respond(error.status || 500, {
      error: error.status ? error.message : "Não foi possível concluir a redefinição. Tente novamente.",
    });
  }
}
