export async function hasGroupMembership(db, read, uid, user) {
  const role = user?.role || user?.type;
  const phone = String(user?.phone || "");
  if (!/^(55)?\d{11}$/.test(phone) || !["admin", "member", "guest"].includes(role)) return false;
  const primary = user.inviteId || phone;
  if (typeof primary !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(primary)) return false;
  let snapshot = await read(db.collection("pre_registered_users").doc(primary));
  if (!snapshot.exists && !user.inviteId) snapshot = await read(db.collection("pre_registered_users").doc(phone.length === 13 ? phone.slice(2) : `55${phone}`));
  const invite = snapshot.data();
  return snapshot.exists && invite.enabled === true && invite.userId === uid &&
    (invite.role || invite.type) === role && (invite.claimed === true || user.firstAccessPending === true);
}
