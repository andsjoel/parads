import { serverTimestamp } from "firebase/firestore";
import { INITIAL_COIN_BALANCE } from "../data/economy";

export function buildInitialUserDocuments({ fullName, phone, role, sex, username = "", authEmail = "", firstAccessPending = false }) {
  const profile = {
    displayName: fullName,
    statusMessage: "",
    selectedBackgroundId: "bg-default",
    selectedProfilePicId: "pic-default",
    selectedProfilePicBorderId: null,
    selectedDisplayCardId: "display-card-orange",
    selectedStatusIcon: "✦",
  };
  const progression = { level: 1, xp: 0, coins: INITIAL_COIN_BALANCE };
  return {
    user: {
      phone, fullName, username, authEmail, role, type: role, sex,
      firstAccessPending, profile, progression,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    },
    publicProfile: {
      fullName, username, role, type: role, sex, profile,
      progression: { coins: progression.coins }, updatedAt: serverTimestamp(),
    },
    stats: {
      matchesPlayed: 0, wins: 0, losses: 0, mvps: 0,
      attendanceConfirmed: 0, attendanceMissed: 0, currentStreak: 0,
      bestStreak: 0, claimedMissionIds: [], sequenceMilestoneHits: {},
      claimedSequenceMilestoneHits: {}, updatedAt: serverTimestamp(),
    },
    inventory: {
      backgrounds: [], profilePics: [], profilePicBorders: [], displayCards: [],
      achievements: [{ id: "member", level: 1, unlockedAt: new Date() }],
      accessories: [], trophies: [], medals: [], titles: [], updatedAt: serverTimestamp(),
    },
    showcase: {
      primaryShelf: ["member"], secondaryShelf: [], selectedTitleId: null,
      updatedAt: serverTimestamp(),
    },
  };
}
