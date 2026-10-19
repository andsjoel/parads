import { normalizeBrazilPhone } from "../utils/phone";
import { requestAccess } from "./accessGatewayService";

export async function findFirstAccessInvite(phone) {
  const normalizedPhone = normalizeBrazilPhone(phone);
  if (!normalizedPhone) throw new Error("Celular invalido.");

  return requestAccess({ action: "lookup", phone: normalizedPhone });
}

export async function validateFirstAccessCode(invite, code) {
  return requestAccess({ action: "verify", phone: String(invite.phone), code });
}

export async function authorizeFirstAccess(invite, username, user) {
  return requestAccess({ action: "authorize", ticket: invite.ticket, username }, await user.getIdToken());
}
