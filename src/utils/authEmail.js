export function buildAuthEmail(username) {
  return `${username.trim().toLowerCase()}@parads.local`;
}