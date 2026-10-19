export async function requestAccess(body, token = null) {
  const response = await fetch("/api/access-gateway", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let result;
  try { result = await response.json(); }
  catch {
    const error = new Error("O serviço de acesso ainda não está disponível neste ambiente.");
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(result?.error || "Não foi possível concluir o acesso.");
    error.status = response.status;
    throw error;
  }
  return result;
}
