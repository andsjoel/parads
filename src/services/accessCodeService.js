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
  const content = `${salt}:${code}`;
  if (crypto.subtle) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return sha256(content);
}

export async function verifyAccessCode(code, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  return (await hashAccessCode(code, salt)) === expectedHash;
}

function sha256(content) {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const bytes = [...new TextEncoder().encode(content)];
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) bytes.push(Math.floor(bitLength / (2 ** shift)) & 0xff);

  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = new Uint32Array(64);
    for (let index = 0; index < 16; index += 1) {
      const start = offset + (index * 4);
      words[index] = ((bytes[start] << 24) | (bytes[start + 1] << 16) | (bytes[start + 2] << 8) | bytes[start + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const first = rotate(words[index - 15], 7) ^ rotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const second = rotate(words[index - 2], 17) ^ rotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + first + words[index - 7] + second) >>> 0;
    }
    const state = [...hash];
    for (let index = 0; index < 64; index += 1) {
      const sumOne = rotate(state[4], 6) ^ rotate(state[4], 11) ^ rotate(state[4], 25);
      const choice = (state[4] & state[5]) ^ (~state[4] & state[6]);
      const temporaryOne = (state[7] + sumOne + choice + constants[index] + words[index]) >>> 0;
      const sumZero = rotate(state[0], 2) ^ rotate(state[0], 13) ^ rotate(state[0], 22);
      const majority = (state[0] & state[1]) ^ (state[0] & state[2]) ^ (state[1] & state[2]);
      const temporaryTwo = (sumZero + majority) >>> 0;
      state.unshift((temporaryOne + temporaryTwo) >>> 0);
      state[4] = (state[4] + temporaryOne) >>> 0;
      state.pop();
    }
    hash.forEach((value, index) => { hash[index] = (value + state[index]) >>> 0; });
  }
  return hash.map((value) => value.toString(16).padStart(8, "0")).join("");
}
