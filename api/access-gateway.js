import process from "node:process";
import { getAdminServices } from "../server/firebaseAdmin.js";
import { AccessError, createAccessGateway, validateAccessPayload } from "../server/accessGateway.js";
import { ApiError, bearerToken, createLocalRequestGate, readJsonBody, requestIp } from "../server/apiProtection.js";

export function createAccessHandler({
  services = getAdminServices, secret = () => process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  enabled = () => [undefined, "true"].includes(process.env.PARADS_ACCESS_GATEWAY_ENABLED) && process.env.PARADS_API_OPERATIONS_PAUSED !== "true",
  registrationEnabled = () => process.env.PARADS_ACCESS_GATEWAY_ENABLED === "true" && process.env.PARADS_REGISTRATION_DISABLED !== "true",
  isVercel = () => process.env.VERCEL === "1", now = Date.now,
} = {}) {
  let gateway;
  const localGate = createLocalRequestGate({ minuteLimit: 480, ipLimit: 240, now });
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const respond = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return respond(405, { error: "Metodo nao permitido." }); }
    try {
      const body = await readJsonBody(req, 4096);
      validateAccessPayload(body);
      if (!enabled()) throw new AccessError(503, "Servico de acesso temporariamente indisponivel.");
      if (body.action !== "login" && !registrationEnabled()) throw new AccessError(503, "Cadastro temporariamente indisponível. Tente mais tarde.");
      const token = body.action === "authorize" ? bearerToken(req) : "";
      const ip = requestIp(req, isVercel());
      localGate(ip);
      gateway ||= createAccessGateway({ ...services(), secret: secret(), now });
      return respond(200, await gateway.execute(body, { ip, token }));
    } catch (error) {
      if (error.status === 429) res.setHeader("Retry-After", String(error.retryAfter || 60));
      const known = error instanceof AccessError || error instanceof ApiError;
      return respond(known ? error.status : 503, { error: known ? error.message : "Servico de acesso indisponivel. Tente novamente." });
    }
  };
}

export default createAccessHandler();
