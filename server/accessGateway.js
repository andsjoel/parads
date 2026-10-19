import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeBrazilPhone } from "../src/utils/phone.js";
import { createSharedRequestLimiter } from "./requestLimits.js";

export class AccessError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const unavailable = () => new AccessError(403, "Convite ou codigo indisponivel.");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const roleOf = (value) => value.role || value.type;
const validUsername = (value) => typeof value === "string" && /^[a-z0-9._-]{5,10}$/.test(value);
const ticketLifetime = 15 * 60_000;

export function validateAccessPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccessError(400, "Solicitacao invalida.");
  const actions = {
    lookup: ["phone"], verify: ["phone", "code"], username: ["ticket", "username"],
    authorize: ["ticket", "username"], login: ["username"],
  };
  const fields = typeof body.action === "string" && Object.hasOwn(actions, body.action) ? actions[body.action] : null;
  if (!fields || Object.keys(body).some((key) => key !== "action" && !fields.includes(key)) ||
    fields.some((key) => typeof body[key] !== "string")) throw new AccessError(400, "Solicitacao invalida.");
  if (fields.includes("phone") && (body.phone.length > 20 || !normalizeBrazilPhone(body.phone))) throw new AccessError(400, "Celular invalido.");
  if (fields.includes("code") && !/^\d{6}$/.test(body.code)) throw new AccessError(400, "Codigo invalido.");
  if (fields.includes("ticket") && body.ticket.length > 1500) throw new AccessError(400, "Autorizacao invalida.");
  if (fields.includes("username") && !(body.action === "login" ? /^[a-z0-9._-]{1,24}$/.test(body.username) : validUsername(body.username))) throw new AccessError(400, "Usuario invalido.");
}

export function createAccessGateway({ db, auth, secret, now = Date.now }) {
  if (typeof secret !== "string" || secret.length < 32) throw new AccessError(503, "Servico de acesso indisponivel.");
  const key = createHmac("sha256", secret).update("parads/access-gateway/v1").digest();
  const mac = (text) => createHmac("sha256", key).update(text).digest("base64url");
  const inviteRef = (id) => db.collection("pre_registered_users").doc(id);
  const limitRequests = createSharedRequestLimiter({
    db, key, namespace: "access_gateway", minuteLimit: 480, dayLimit: 3000, ipLimit: 240, now,
  });

  function readTicket(ticket) {
    const [payload, signature, extra] = ticket.split(".");
    const expected = mac(payload || "");
    if (extra !== undefined || !/^[a-zA-Z0-9_-]{43}$/.test(signature || "") || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw unavailable();
    let claims;
    try { claims = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { throw unavailable(); }
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(claims.id) || !Number.isFinite(claims.exp) || claims.exp <= now() || claims.exp > now() + ticketLifetime || !/^[a-f0-9]{64}$/.test(claims.proof)) throw unavailable();
    return claims;
  }
  const proof = (invite) => digest(`${invite.accessCodeSalt}:${invite.accessCodeHash}`);

  function checkInvite(invite, claims = null, allowClaimed = false) {
    if (!invite || invite.enabled !== true || (!allowClaimed && invite.claimed === true) || !["admin", "member", "guest"].includes(roleOf(invite)) || (claims && claims.proof !== proof(invite))) throw unavailable();
    return invite;
  }

  async function pendingInvite(id, claims = null, allowClaimed = false) {
    const snapshot = await inviteRef(id).get();
    const invite = snapshot.data();
    return checkInvite(invite, claims, allowClaimed);
  }

  async function findInvite(phone) {
    const normalized = normalizeBrazilPhone(phone);
    const local = normalized.slice(2);
    for (const id of [normalized, local]) {
      const snapshot = await inviteRef(id).get();
      if (snapshot.exists) return snapshot;
    }
    // Bounded compatibility with older phone fields; never list the collection.
    for (const value of [normalized, local, Number(normalized), Number(local)]) {
      const result = await db.collection("pre_registered_users").where("phone", "==", value).limit(1).get();
      if (!result.empty) return result.docs[0];
    }
    throw unavailable();
  }

  return {
    async execute(body, { ip = "unknown", token = "" } = {}) {
      validateAccessPayload(body);
      let claims;
      if (["username", "authorize"].includes(body.action)) claims = readTicket(body.ticket);
      let identity;
      if (body.action === "authorize") {
        if (!token || token.length > 8192) throw new AccessError(401, "Entre novamente para continuar.");
      }
      await limitRequests(ip, body.action === "verify" ? `code:${normalizeBrazilPhone(body.phone)}` : null);
      if (body.action === "authorize") {
        try { identity = await auth.verifyIdToken(token, true); } catch { throw new AccessError(401, "Sessao invalida."); }
      }
      if (body.action === "login") {
        const entry = (await db.collection("usernames").doc(body.username).get()).data();
        const email = entry?.authEmail || `${body.username}@parads.local`;
        return { authEmail: typeof email === "string" && /^[a-z0-9._-]+@parads\.local$/.test(email) ? email : `${body.username}@parads.local` };
      }
      if (["lookup", "verify"].includes(body.action)) {
        const found = await findInvite(body.phone);
        const invite = checkInvite(found.data());
        if (body.action === "lookup") return { id: found.id, phone: invite.phone, fullName: invite.fullName };
        const hash = digest(`${invite.accessCodeSalt}:${body.code}`);
        if (typeof invite.accessCodeHash !== "string" || hash.length !== invite.accessCodeHash.length || !timingSafeEqual(Buffer.from(hash), Buffer.from(invite.accessCodeHash))) throw unavailable();
        const payload = Buffer.from(JSON.stringify({ id: found.id, proof: proof(invite), exp: now() + ticketLifetime })).toString("base64url");
        return { ticket: `${payload}.${mac(payload)}`, pendingAuthEmail: invite.pendingAuthEmail || null, role: roleOf(invite), type: roleOf(invite), sex: invite.sex || "male" };
      }
      const invite = await pendingInvite(claims.id, claims, body.action === "authorize");
      const usernameRef = db.collection("usernames").doc(body.username);
      if (body.action === "username") return { available: !(await usernameRef.get()).exists };
      const account = await auth.getUser(identity.uid);
      const authEmail = invite.pendingAuthEmail || `${body.username}@parads.local`;
      if (account.disabled || account.email !== authEmail || (invite.userId && invite.userId !== identity.uid)) throw unavailable();
      const grantRef = db.collection("registration_grants").doc(identity.uid);
      const completed = await db.runTransaction(async (tx) => {
        const [fresh, username, user] = await Promise.all([
          tx.get(inviteRef(claims.id)), tx.get(usernameRef), tx.get(db.collection("users").doc(identity.uid)),
        ]);
        const current = fresh.data();
        if (!fresh.exists || current.enabled !== true || proof(current) !== claims.proof || (current.userId && current.userId !== identity.uid) || roleOf(current) !== roleOf(invite)) throw unavailable();
        if (current.claimed === true) {
          if (current.userId === identity.uid && user.exists && user.data().username === body.username && user.data().authEmail === authEmail && user.data().phone === current.phone) return true;
          throw unavailable();
        }
        if (username.exists) throw new AccessError(409, "Esse usuario ja esta em uso.");
        if (user.exists && (!current.pendingAuthEmail || user.data().firstAccessPending !== true || user.data().authEmail !== account.email)) throw unavailable();
        tx.set(grantRef, {
          inviteId: claims.id, phone: current.phone, role: roleOf(current), username: body.username,
          authEmail, codeHash: current.accessCodeHash, codeSalt: current.accessCodeSalt,
          expiresAt: Timestamp.fromMillis(Math.min(claims.exp, now() + ticketLifetime)),
        });
        return false;
      }, { maxAttempts: 2 });
      return { authorized: true, completed };
    },
  };
}
