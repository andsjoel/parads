export function generateAccessCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

export function generateAccessCodeSalt() {
  const values = new Uint8Array(16);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function hashAccessCode(code, salt) {
  const value = new TextEncoder().encode(`${salt}:${code}`);
  const hash = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function verifyAccessCode(code, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  return (await hashAccessCode(code, salt)) === expectedHash;
}
