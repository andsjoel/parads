import { profilePicsCatalog } from "./profilePicsCatalog";
import { profileBackgroundsCatalog } from "./profileBackgroundsCatalog";

export const promotionalMissions = [
  { id: "customization-v1-pic", title: "Sua primeira pic", description: "Compre uma pic normal na loja.", kind: "profilePic", reward: 1 },
  { id: "customization-v1-cover", title: "Sua primeira capa", description: "Compre uma capa normal na loja.", kind: "background", reward: 1 },
  { id: "customization-v1-name", title: "Do seu jeito", description: "Altere seu nome de exibição no perfil.", kind: "displayName", reward: 1 },
  { id: "customization-v1-status", title: "Dê seu recado", description: "Personalize a mensagem do seu status.", kind: "status", reward: 1 },
];

export function qualifiesForPromotionalPurchase(item) {
  return Boolean(item && (item.rarity || "normal") === "normal");
}

export function getPersonalizationProgress(user = {}, profile = user.profile || {}) {
  const previous = user.profile || {};
  const displayName = profile.displayName?.trim() || "";
  const previousName = previous.displayName?.trim() || user.fullName?.trim() || "";
  return {
    ...(user.promotionalProgress || {}),
    displayNameChanged: Boolean(user.promotionalProgress?.displayNameChanged
      || (displayName && ((user.fullName?.trim() && displayName !== user.fullName.trim()) || displayName !== previousName))),
    statusChanged: Boolean(user.promotionalProgress?.statusChanged
      || profile.statusMessage?.trim() || previous.statusMessage?.trim()),
  };
}

export function getPromotionalMissionStates(user = {}, inventory = {}, stats = {}) {
  const progress = getPersonalizationProgress(user);
  const hasPurchase = (field, catalog) => (inventory[field] || []).some((id) =>
    qualifiesForPromotionalPurchase(catalog.find((item) => item.id === id)));
  const completed = {
    profilePic: Boolean(progress.profilePicPurchased || hasPurchase("profilePics", profilePicsCatalog)),
    background: Boolean(progress.backgroundPurchased || hasPurchase("backgrounds", profileBackgroundsCatalog)),
    displayName: progress.displayNameChanged,
    status: progress.statusChanged,
  };
  const claimed = new Set(stats.claimedPromotionalMissionIds || []);
  return promotionalMissions.map((mission) => ({
    ...mission,
    completed: Boolean(completed[mission.kind]) || claimed.has(mission.id),
    claimed: claimed.has(mission.id),
    claimable: Boolean(completed[mission.kind]) && !claimed.has(mission.id),
  }));
}
