import { Buffer } from "node:buffer";
import { isIP } from "node:net";

export class ApiError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export async function readJsonBody(req, maxBytes) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) {
    throw new ApiError(415, "Formato inválido. Use JSON.");
  }
  if (Number(req.headers["content-length"]) > maxBytes) throw new ApiError(413, "Solicitação muito grande.");
  let body = req.body;
  if (body === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) throw new ApiError(413, "Solicitação muito grande.");
      chunks.push(bytes);
    }
    body = Buffer.concat(chunks).toString("utf8");
  }
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  let encoded;
  try { encoded = typeof body === "string" ? body : JSON.stringify(body); }
  catch { throw new ApiError(400, "Solicitação inválida."); }
  if (typeof encoded !== "string") throw new ApiError(400, "Solicitação inválida.");
  if (Buffer.byteLength(encoded) > maxBytes) throw new ApiError(413, "Solicitação muito grande.");
  if (typeof body !== "string") return body;
  try { return JSON.parse(body); }
  catch { throw new ApiError(400, "Solicitação inválida."); }
}

export function bearerToken(req) {
  const value = req.headers.authorization;
  // Shape/size only. Admin SDK verifies the signature; emulator JWTs are unsigned.
  if (typeof value !== "string" || value.length > 8200 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(value)) {
    throw new ApiError(401, "Entre novamente para continuar.");
  }
  return value.slice(7);
}

export function requestIp(req, isVercel = false) {
  // Trust Vercel's overwritten header only on Vercel, not a caller's X-Forwarded-For.
  const header = isVercel ? req.headers["x-vercel-forwarded-for"] : null;
  const candidate = typeof header === "string" ? header.split(",")[0].trim() : "";
  const address = isIP(candidate) ? candidate : req.socket?.remoteAddress;
  return typeof address === "string" && isIP(address) ? address : "unknown";
}

// Cheap per-instance guard. The Firestore limiter remains the shared authority.
export function createLocalRequestGate({ minuteLimit, ipLimit, now = Date.now }) {
  let minute = -1;
  let total = 0;
  const ips = new Map();
  return (ip) => {
    const next = Math.floor(now() / 60000);
    if (next !== minute) { minute = next; total = 0; ips.clear(); }
    if (total >= minuteLimit || (ips.get(ip) || 0) >= ipLimit || (!ips.has(ip) && ips.size >= 256)) {
      throw new ApiError(429, "Muitas tentativas. Aguarde um pouco.", 60);
    }
    total += 1;
    ips.set(ip, (ips.get(ip) || 0) + 1);
  };
}
