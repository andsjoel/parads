export const TEST_PASSWORD = "OnlyForLocalTests123!";
export const fixtureAccounts = [
  { uid: "fixture-admin", role: "admin", phone: "5561000000001", claimed: true },
  { uid: "fixture-member", role: "member", phone: "5561000000002", claimed: true },
  { uid: "fixture-guest", role: "guest", phone: "5561000000003", claimed: false },
  { uid: "fixture-disabled", role: "member", phone: "5561000000004", claimed: true, enabled: false },
];

export function fixtureDocuments() {
  const documents = {};
  for (const { uid, role, phone, claimed, enabled = true } of fixtureAccounts) {
    documents[`users/${uid}`] = {
      fullName: `Synthetic ${role}`, username: uid, phone, role, type: role,
      sex: "male", profile: { displayName: `Synthetic ${role}`, statusMessage: "" },
      firstAccessPending: !claimed, progression: { coins: 17 },
    };
    documents[`pre_registered_users/${phone}`] = { phone, fullName: `Synthetic ${role}`, role, userId: uid, enabled, claimed };
    documents[`public_profiles/${uid}`] = { fullName: `Synthetic ${role}`, username: uid, role };
    documents[`user_stats/${uid}`] = { wins: 3, matchesPlayed: 5, attendanceConfirmed: 2 };
    documents[`user_inventory/${uid}`] = { profilePics: ["pic-default"], profileBackgrounds: ["bg-default"] };
    documents[`user_showcase/${uid}`] = { profilePic: "pic-default", status: "Synthetic status" };
    if (claimed) documents[`usernames/${uid}`] = { userId: uid, authEmail: `${uid}@example.test` };
  }
  // Legacy member intentionally has no account_security document or new membership fields.
  documents["volley_lists/fixture-day"] = { status: "in_progress", revision: 0, teams: [], games: [] };
  documents["feed_posts/fixture-post"] = { title: "Synthetic post" };
  documents["volley_reports/fixture-report"] = { matches: 5 };
  return documents;
}
