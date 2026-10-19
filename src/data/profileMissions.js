function mission(category, threshold, reward, description) {
  return {
    id: `${category}-${threshold}`,
    category,
    threshold,
    reward,
    description,
  };
}

const oddMatches = Array.from({ length: 25 }, (_, index) => index * 2 + 1);
const progressive = Array.from({ length: 49 }, (_, index) => index + 2);
const attendance = Array.from({ length: 50 }, (_, index) => index + 1);
const sequenceRewards = { 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 3, 9: 4, 10: 5 };
const legacySequenceRewards = { 2: 1, 5: 2, 10: 3, 15: 4, 20: 5 };
export const sequenceMilestones = Object.keys(sequenceRewards).map(Number);

export function getSequenceReward(threshold) {
  return sequenceRewards[threshold] || legacySequenceRewards[threshold] || 0;
}

export function getClaimedSequenceRewardAmount(stats, threshold) {
  const amount = stats.claimedSequenceRewardAmounts?.[threshold];
  if (Number.isSafeInteger(amount) && amount >= 0) return amount;
  return (stats.claimedSequenceMilestoneHits?.[threshold] || 0) * (legacySequenceRewards[threshold] || 0);
}

export const profileMissions = {
  matchesPlayed: oddMatches.map((threshold) =>
    mission(
      "matchesPlayed",
      threshold,
      1,
      threshold === 1 ? "Jogue sua primeira partida." : `Jogue ${threshold} partidas.`,
    ),
  ),
  wins: progressive.map((threshold) =>
    mission("wins", threshold, 1, `Vença ${threshold} partidas.`),
  ),
  attendanceConfirmed: attendance.map((threshold) =>
    mission(
      "attendanceConfirmed",
      threshold,
      1,
      threshold === 1
        ? "Compareça à sua primeira pelada."
        : `Compareça a ${threshold} peladas.`,
    ),
  ),
  currentStreak: sequenceMilestones.map((threshold) =>
    mission(
      "currentStreak",
      threshold,
      getSequenceReward(threshold),
      threshold === 2
        ? "Faça uma sequência de 2 vitórias."
        : `Vença ${threshold} partidas seguidas.`,
    ),
  ),
  bestStreak: Array.from({ length: 20 }, (_, index) => index + 1).map((threshold) =>
    mission(
      "bestStreak",
      threshold,
      threshold,
      threshold === 1 ? "Defina seu primeiro recorde." : `Alcance um recorde de ${threshold} vitórias.`,
    ),
  ),
};

export function getProfileStatValue(stats = {}, category) {
  if (category === "matchesPlayed") {
    return Math.max(stats.matchesPlayed || 0, stats.gamesPlayed || 0);
  }

  if (category === "attendanceConfirmed") {
    return Math.max(stats.attendanceConfirmed || 0, stats.matchesAttended || 0);
  }

  if (category === "currentStreak") {
    return Math.max(stats.currentStreak || 0, stats.currentWinStreak || 0);
  }

  if (category === "bestStreak") {
    return Math.max(stats.bestStreak || 0, stats.bestDailyWinStreak || 0);
  }

  return stats[category] || 0;
}

export function getClaimableMissions(stats = {}) {
  const claimed = new Set(stats.claimedMissionIds || []);

  return Object.entries(profileMissions).flatMap(([category, missions]) => {
    if (category === "currentStreak") return [];
    const value = getProfileStatValue(stats, category);
    return missions.filter(
      (item) => value >= item.threshold && !claimed.has(item.id),
    );
  });
}

export function getPendingSequenceRewards(stats = {}) {
  const hits = stats.sequenceMilestoneHits || {};
  const claimedHits = stats.claimedSequenceMilestoneHits || {};

  return getSequenceMissions(stats).map(({ threshold }) => {
    const earnedCount = hits[threshold] || 0;
    const claimedCount = claimedHits[threshold] || 0;
    const pendingCount = Math.max(0, earnedCount - claimedCount);
    const claimedAmount = getClaimedSequenceRewardAmount(stats, threshold);
    return {
      threshold,
      pendingCount,
      reward: getSequenceReward(threshold),
      totalReward: Math.max(0, earnedCount * getSequenceReward(threshold) - claimedAmount),
    };
  }).filter((item) => item.totalReward > 0);
}

export function getSequenceMissions(stats = {}) {
  // Honor already earned legacy milestones without issuing them for new games.
  const legacy = [15, 20].filter((threshold) => stats.sequenceMilestoneHits?.[threshold] > 0);
  return [...profileMissions.currentStreak, ...legacy.map((threshold) =>
    mission("currentStreak", threshold, getSequenceReward(threshold), `Vença ${threshold} partidas seguidas.`),
  )];
}
