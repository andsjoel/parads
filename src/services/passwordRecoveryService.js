import { auth } from "../firebase/firebase";

async function requestRecovery(body) {
  if (!auth.currentUser) throw new Error("Entre novamente para continuar.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/password-recovery", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error("O serviço de recuperação ainda não está disponível neste ambiente."); }
  if (!response.ok) throw new Error(result.error || "Não foi possível redefinir a senha.");
  return result;
}

export function resetAccountPassword(inviteId) {
  return requestRecovery({ action: "reset", inviteId });
}

export function completePasswordRecovery(password) {
  return requestRecovery({ action: "complete", password });
}
