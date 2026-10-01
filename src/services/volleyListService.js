import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { sequenceMilestones } from "../data/profileMissions";
import { profilePicsCatalog } from "../data/profilePicsCatalog";
import { profilePicBordersCatalog } from "../data/profilePicBordersCatalog";
import { profileBackgroundsCatalog } from "../data/profileBackgroundsCatalog";
import { DEFAULT_DISPLAY_CARD_ID } from "../data/displayCardsCatalog";

const COLLECTION_NAME = "volley_lists";
const TEAM_SIZE = 6;
const mockNames = [
  "Alex", "Bia", "Caio", "Dani", "Eli", "Fê", "Gabi", "Hugo",
  "Iara", "João", "Katia", "Leo", "Maya", "Nando", "Olivia", "Pietro",
  "Rafa", "Sara", "Theo", "Vivi", "Will", "Yasmin", "Zeca", "Aline",
  "Bruno", "Clara", "Diego", "Eva", "Felipe", "Luna",
];

function pickMockAsset(catalog, index, offset = 0) {
  return catalog[(index + offset) % catalog.length]?.id || null;
}

export function buildMockProfileBundle(player, index) {
  const selectedProfilePicId = pickMockAsset(profilePicsCatalog, index);
  const selectedProfilePicBorderId = pickMockAsset(
    profilePicBordersCatalog,
    index,
    3,
  );
  const selectedBackgroundId = pickMockAsset(
    profileBackgroundsCatalog,
    index,
    5,
  );

  return {
    user: {
      id: player.userId,
      fullName: player.displayName,
      username: `teste${String(index + 1).padStart(2, "0")}`,
      role: "guest",
      sex: player.sex,
      profile: {
        displayName: player.displayName,
        statusMessage: index % 3 === 0 ? "pronto pra quadra" : "hoje tem vôlei",
        selectedProfilePicId,
        selectedProfilePicBorderId,
        selectedBackgroundId,
        selectedDisplayCardId: DEFAULT_DISPLAY_CARD_ID,
        selectedStatusIcon: index % 2 === 0 ? "🏐" : "🔥",
      },
      progression: { coins: index % 12 },
    },
    inventory: {
      profilePics: [selectedProfilePicId],
      profilePicBorders: [selectedProfilePicBorderId],
      backgrounds: [selectedBackgroundId],
      displayCards: [],
    },
    stats: {
      matchesPlayed: 4 + index,
      wins: index % 9,
      attendanceConfirmed: 2 + (index % 12),
      currentStreak: index % 4,
      bestStreak: 2 + (index % 7),
    },
  };
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function asPlain(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function buildParticipant(userData) {
  return {
    id: userData.id,
    name: userData.profile?.displayName || userData.fullName || userData.username,
    username: userData.username,
    role: userData.role || "member",
    sex: userData.sex || "male",
  };
}

function buildMatchPlayerFromUser(userData, overrides = {}, persistedStats = {}) {
  const source = buildParticipant(userData);
  const currentStreak = persistedStats.currentStreak || 0;
  const bestStreak = Math.max(
    persistedStats.bestStreak || 0,
    persistedStats.bestDailyWinStreak || 0,
    currentStreak,
  );

  return {
    entryId: createId("player"),
    kind: source.role === "guest" ? "guest" : "member",
    userId: source.id,
    displayName: source.name,
    username: source.username || "",
    sex: overrides.sex || source.sex || "male",
    isSetter: Boolean(overrides.isSetter),
    addedAt: new Date().toISOString(),
    removedAt: null,
    stats: {
      ...emptyPlayerStats(),
      currentWinStreak: currentStreak,
      bestWinStreak: bestStreak,
    },
  };
}

function emptyPlayerStats() {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    setterGames: 0,
    setterWins: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    sequenceMilestoneHits: {},
    returnTeamAppearances: 0,
  };
}

async function syncPersistedGameStats({ transaction, beforePlayers, afterPlayers, game, direction }) {
  if (!game || !direction) return;

  const beforeByEntryId = new Map((beforePlayers || []).map((player) => [player.entryId, player]));
  const afterByEntryId = new Map((afterPlayers || []).map((player) => [player.entryId, player]));
  const resultEntryIds = [...(game.winnerPlayers || []), ...(game.loserPlayers || [])];
  const resultPlayers = resultEntryIds
    .map((entryId) => afterByEntryId.get(entryId) || beforeByEntryId.get(entryId))
    .filter((player) => player?.userId);
  const uniquePlayers = [...new Map(resultPlayers.map((player) => [player.userId, player])).values()];
  const statsSnapshots = await Promise.all(
    uniquePlayers.map((player) => transaction.get(doc(db, "user_stats", player.userId))),
  );

  uniquePlayers.forEach((player, index) => {
    const statsSnap = statsSnapshots[index];
    if (!statsSnap.exists()) return;

    const persistedStats = statsSnap.data();
    const beforePlayer = beforeByEntryId.get(player.entryId) || player;
    const afterPlayer = afterByEntryId.get(player.entryId) || player;
    const targetPlayer = direction > 0 ? afterPlayer : beforePlayer;
    const targetLocalStats = targetPlayer.stats || emptyPlayerStats();
    const isWinner = (game.winnerPlayers || []).includes(player.entryId);
    const matchesPlayed = Math.max(0, Math.max(
      persistedStats.matchesPlayed || 0,
      persistedStats.gamesPlayed || 0,
    ) + direction);
    const statsUpdate = {
      matchesPlayed,
      gamesPlayed: matchesPlayed,
      setterGames: Math.max(0, (persistedStats.setterGames || 0) + (player.isSetter ? direction : 0)),
      updatedAt: serverTimestamp(),
    };

    if (isWinner) {
      const sequenceMilestoneHits = { ...(persistedStats.sequenceMilestoneHits || {}) };
      const beforeHits = beforePlayer.stats?.sequenceMilestoneHits || {};
      const afterHits = afterPlayer.stats?.sequenceMilestoneHits || {};

      sequenceMilestones.forEach((threshold) => {
        const gameDelta = (afterHits[threshold] || 0) - (beforeHits[threshold] || 0);
        if (!gameDelta) return;
        sequenceMilestoneHits[threshold] = Math.max(
          0,
          (sequenceMilestoneHits[threshold] || 0) + (gameDelta * direction),
        );
      });

      Object.assign(statsUpdate, {
        wins: Math.max(0, (persistedStats.wins || 0) + direction),
        setterWins: Math.max(0, (persistedStats.setterWins || 0) + (player.isSetter ? direction : 0)),
        currentStreak: targetLocalStats.currentWinStreak || 0,
        currentWinStreak: targetLocalStats.currentWinStreak || 0,
        bestStreak: targetLocalStats.bestWinStreak || 0,
        bestDailyWinStreak: targetLocalStats.bestWinStreak || 0,
        sequenceMilestoneHits,
      });
    } else {
      Object.assign(statsUpdate, {
        losses: Math.max(0, (persistedStats.losses || 0) + direction),
        currentStreak: targetLocalStats.currentWinStreak || 0,
        currentWinStreak: targetLocalStats.currentWinStreak || 0,
      });
    }

    transaction.update(statsSnap.ref, statsUpdate);
  });
}

async function syncPersistedAttendance({ transaction, fromUserIds, toUserIds }) {
  if (!Array.isArray(fromUserIds) || !Array.isArray(toUserIds)) return;

  const from = new Set(fromUserIds);
  const to = new Set(toUserIds);
  const changes = [
    ...[...to].filter((userId) => !from.has(userId)).map((userId) => ({ userId, direction: 1 })),
    ...[...from].filter((userId) => !to.has(userId)).map((userId) => ({ userId, direction: -1 })),
  ];
  if (!changes.length) return;

  const statsSnapshots = await Promise.all(
    changes.map(({ userId }) => transaction.get(doc(db, "user_stats", userId))),
  );

  changes.forEach(({ direction }, index) => {
    const statsSnap = statsSnapshots[index];
    if (!statsSnap.exists()) return;
    const stats = statsSnap.data();
    const attendance = Math.max(0, Math.max(
      stats.attendanceConfirmed || 0,
      stats.matchesAttended || 0,
    ) + direction);

    transaction.update(statsSnap.ref, {
      attendanceConfirmed: attendance,
      matchesAttended: attendance,
      updatedAt: serverTimestamp(),
    });
  });
}

function getGroupKey(group) {
  if (group === "setter") return "setters";
  if (group === "player") return "players";

  throw new Error("Grupo invalido.");
}

function removeParticipantFromGroups(list, userId) {
  return {
    setters: (list.setters || []).filter((person) => person.id !== userId),
    players: (list.players || []).filter((person) => person.id !== userId),
  };
}

function getParticipantGroup(list, userId) {
  if ((list.setters || []).some((person) => person.id === userId)) return "setter";
  if ((list.players || []).some((person) => person.id === userId)) return "player";

  return null;
}

function activePlayers(list) {
  return (list.matchPlayers || []).filter((player) => !player.removedAt);
}

function getPlayer(list, entryId) {
  return (list.matchPlayers || []).find((player) => player.entryId === entryId);
}

function getTeamPlayers(list, team) {
  return (team?.players || [])
    .map((entryId) => getPlayer(list, entryId))
    .filter(Boolean);
}

function canAddPlayerToTeam(list, team, player) {
  const players = getTeamPlayers(list, team);
  const teamWomenRuleMode = team.womenRuleMode || list.womenRuleMode || "one";
  const temporarySetterEntryId = (team.players || []).includes(team.temporarySetterEntryId)
    ? team.temporarySetterEntryId
    : null;
  const hasSetter = players.some((item) => item.isSetter)
    || Boolean(temporarySetterEntryId);

  if ((team.players || []).length >= TEAM_SIZE) return false;
  if (player.isSetter && hasSetter) return false;

  const temporaryWomanIds = new Set(team.temporaryWomanEntryIds || []);
  const womenCount = players.filter(
    (item) => (
      (item.sex === "female" || temporaryWomanIds.has(item.entryId))
      && !item.isSetter
      && item.entryId !== temporarySetterEntryId
    ),
  ).length;
  const womenLimit = teamWomenRuleMode === "two" ? 2 : 1;

  if (
    teamWomenRuleMode !== "random"
    && player.sex === "female"
    && !player.isSetter
    && womenCount >= womenLimit
  ) return false;

  const playersAfterAdd = [...players, player];
  const missingSetterSlots = hasSetter || player.isSetter ? 0 : 1;
  const womenAfterAdd = playersAfterAdd.filter(
    (item) => (
      (item.sex === "female" || temporaryWomanIds.has(item.entryId))
      && !item.isSetter
      && item.entryId !== temporarySetterEntryId
    ),
  ).length;
  const missingWomenSlots = Math.max(0, womenLimit - womenAfterAdd);

  if (playersAfterAdd.length + missingSetterSlots + missingWomenSlots > TEAM_SIZE) {
    return false;
  }

  return true;
}

function addPlayerToTeams(list, entryId) {
  const player = getPlayer(list, entryId);
  if (!player) return;

  const teams = [...(list.teams || [])].map((team) => ({
    ...team,
    players: [...(team.players || [])],
  }));

  for (const team of teams) {
    if (canAddPlayerToTeam({ ...list, teams }, team, player)) {
      team.players.push(entryId);
      return teams;
    }
  }

  teams.push({
    id: createId("team"),
    players: [entryId],
    wins: 0,
    womenRuleMode: list.womenRuleMode || "one",
  });

  return teams;
}

function removeEntryFromTeamList(teams, entryId) {
  return (teams || [])
    .map((team) => ({
      ...team,
      players: (team.players || []).filter((id) => id !== entryId),
      temporarySetterEntryId: team.temporarySetterEntryId === entryId
        ? null
        : team.temporarySetterEntryId || null,
      temporaryWomanEntryIds: (team.temporaryWomanEntryIds || []).filter(
        (id) => id !== entryId,
      ),
    }))
    .filter((team) => team.players.length > 0);
}

function removeEntryEverywhere(list, entryId) {
  return {
    teams: removeEntryFromTeamList(list.teams || [], entryId),
    returnTeam: list.returnTeam
      ? {
          ...list.returnTeam,
          players: (list.returnTeam.players || []).filter((id) => id !== entryId),
          temporarySetterEntryId: list.returnTeam.temporarySetterEntryId === entryId
            ? null
            : list.returnTeam.temporarySetterEntryId || null,
          temporaryWomanEntryIds: (list.returnTeam.temporaryWomanEntryIds || []).filter(
            (id) => id !== entryId,
          ),
        }
      : null,
  };
}

function relocatePlayer(list, teams, entryId) {
  const player = getPlayer(list, entryId);
  if (!player) return teams;

  for (const team of teams) {
    if (canAddPlayerToTeam({ ...list, teams }, team, player)) {
      team.players.push(entryId);
      return teams;
    }
  }

  teams.push({
    id: createId("team"),
    players: [entryId],
    wins: 0,
    womenRuleMode: list.womenRuleMode || "one",
  });

  return teams;
}

function shuffle(items) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function adaptWaitingTeamsForWomenRule(list, nextMode) {
  const currentMode = list.womenRuleMode || "one";
  const teams = (list.teams || []).map((team, index) => ({
    ...team,
    players: [...(team.players || [])],
    temporaryWomanEntryIds: [...(team.temporaryWomanEntryIds || [])],
    womenRuleMode: index >= 2 && (team.players || []).length < TEAM_SIZE
      ? nextMode
      : team.womenRuleMode || currentMode,
  }));

  if (currentMode !== "two" && nextMode === "two") {
    const displaced = [];

    for (let teamIndex = 2; teamIndex < teams.length; teamIndex += 1) {
      const team = teams[teamIndex];
      if ((list.teams?.[teamIndex]?.players || []).length >= TEAM_SIZE) continue;

      while (true) {
        const teamPlayers = team.players.map((id) => getPlayer(list, id)).filter(Boolean);
        const hasSetter = teamPlayers.some((player) => player.isSetter)
          || team.players.includes(team.temporarySetterEntryId);
        const temporaryWomanIds = new Set(team.temporaryWomanEntryIds || []);
        const womenCount = teamPlayers.filter((player) => (
          !player.isSetter
          && player.entryId !== team.temporarySetterEntryId
          && (player.sex === "female" || temporaryWomanIds.has(player.entryId))
        )).length;
        const requiredSize = team.players.length
          + (hasSetter ? 0 : 1)
          + Math.max(0, 2 - womenCount);
        if (requiredSize <= TEAM_SIZE) break;

        const removable = shuffle(team.players.filter((id) => {
          const player = getPlayer(list, id);
          return player
            && !player.isSetter
            && player.sex !== "female"
            && team.temporarySetterEntryId !== id
            && !temporaryWomanIds.has(id);
        }))[0];
        if (!removable) break;
        team.players = team.players.filter((id) => id !== removable);
        displaced.push({ entryId: removable, afterIndex: teamIndex });
      }
    }

    displaced.forEach(({ entryId, afterIndex }) => {
      const player = getPlayer(list, entryId);
      let placed = false;
      for (let index = afterIndex + 1; index < teams.length; index += 1) {
        if (canAddPlayerToTeam({ ...list, teams, womenRuleMode: nextMode }, teams[index], player)) {
          teams[index].players.push(entryId);
          placed = true;
          break;
        }
      }
      if (!placed) {
        teams.push({
          id: createId("team"),
          players: [entryId],
          wins: 0,
          womenRuleMode: nextMode,
          temporaryWomanEntryIds: [],
        });
      }
    });

    return teams;
  }

  if (currentMode !== "two" || nextMode === "two") return teams;

  for (let targetIndex = 2; targetIndex < teams.length; targetIndex += 1) {
    const targetTeam = teams[targetIndex];
    if (targetTeam.players.length >= TEAM_SIZE) continue;

    while (targetTeam.players.length < TEAM_SIZE) {
      const candidates = [];

      for (let sourceIndex = targetIndex + 1; sourceIndex < teams.length; sourceIndex += 1) {
        const sourceTeam = teams[sourceIndex];
        sourceTeam.players.forEach((candidateId) => {
          const player = getPlayer(list, candidateId);
          const occupiesSpecialSlot = sourceTeam.temporarySetterEntryId === candidateId
            || sourceTeam.temporaryWomanEntryIds.includes(candidateId);
          const sourceWomenCount = sourceTeam.players.filter((id) => {
            const sourcePlayer = getPlayer(list, id);
            return sourcePlayer
              && sourcePlayer.sex === "female"
              && !sourcePlayer.isSetter
              && id !== sourceTeam.temporarySetterEntryId;
          }).length;
          const isRandomExtraWoman = nextMode === "random"
            && player?.sex === "female"
            && sourceWomenCount > 1;
          if (
            !player
            || player.isSetter
            || (player.sex === "female" && !isRandomExtraWoman)
            || occupiesSpecialSlot
          ) return;
          if (canAddPlayerToTeam({ ...list, teams, womenRuleMode: nextMode }, targetTeam, player)) {
            candidates.push({ candidateId, sourceIndex });
          }
        });
      }

      if (!candidates.length) break;
      const selected = shuffle(candidates)[0];
      const sourceTeam = teams[selected.sourceIndex];
      sourceTeam.players = sourceTeam.players.filter((id) => id !== selected.candidateId);
      sourceTeam.temporaryWomanEntryIds = sourceTeam.temporaryWomanEntryIds.filter(
        (id) => id !== selected.candidateId,
      );
      targetTeam.players.push(selected.candidateId);
    }
  }

  return teams;
}

function isValidInitialTeam(list, players, totalWomen) {
  const womenLimit = list.womenRuleMode === "two" ? 2 : 1;
  const womenCount = players.filter(
    (player) => player.sex === "female" && !player.isSetter,
  ).length;
  const requiredWomen = Math.min(womenLimit, Math.floor(totalWomen / 2));
  return players.length === TEAM_SIZE
    && players.filter((player) => player.isSetter).length === 1
    && (list.womenRuleMode === "random" || womenCount <= womenLimit)
    && womenCount >= requiredWomen;
}

function orderInitialTeam(players) {
  return [...players].sort((first, second) => {
    const rank = (player) => {
      if (player.isSetter) return 0;
      if (player.sex === "female") return 1;
      return 2;
    };
    return rank(first) - rank(second);
  });
}

function buildInitialTeams(list, arrivals) {
  const firstTwelve = arrivals.slice(0, TEAM_SIZE * 2);
  const totalWomen = firstTwelve.filter(
    (player) => player.sex === "female" && !player.isSetter,
  ).length;
  const indexes = shuffle(firstTwelve.map((_, index) => index));
  const combinations = [];

  function collect(start, selected) {
    if (selected.length === TEAM_SIZE) {
      combinations.push([...selected]);
      return;
    }

    for (let index = start; index < indexes.length; index += 1) {
      selected.push(indexes[index]);
      collect(index + 1, selected);
      selected.pop();
    }
  }

  collect(0, []);

  for (const selectedIndexes of shuffle(combinations)) {
    const selected = new Set(selectedIndexes);
    const firstTeam = firstTwelve.filter((_, index) => selected.has(index));
    const secondTeam = firstTwelve.filter((_, index) => !selected.has(index));

    if (isValidInitialTeam(list, firstTeam, totalWomen) && isValidInitialTeam(list, secondTeam, totalWomen)) {
      return [firstTeam, secondTeam].map((players) => ({
        id: createId("team"),
        players: orderInitialTeam(shuffle(players)).map((player) => player.entryId),
        wins: 0,
        womenRuleMode: list.womenRuleMode || "one",
      }));
    }
  }

  throw new Error(
    "Nao foi possivel formar dois times com as regras atuais. Revise levantadores e mulheres.",
  );
}

function redistributeLoser(list, teams, loserTeam) {
  const loserIds = loserTeam.players || [];
  shuffle(loserIds).forEach((entryId) => {
    teams = relocatePlayer(list, teams, entryId);
  });

  return teams;
}

function snapshotBefore(list) {
  return {
    teamsFormed: Boolean(list.teamsFormedAt),
    teams: asPlain(list.teams || []),
    returnTeam: asPlain(list.returnTeam || null),
    matchPlayers: asPlain(list.matchPlayers || []),
    games: asPlain(list.games || []),
    attendedUserIds: asPlain(list.attendedUserIds || []),
    summary: asPlain(list.summary || {}),
    womenRuleMode: list.womenRuleMode || "one",
    exitAfterTwoWins: list.exitAfterTwoWins !== false,
  };
}

function appendHistory(list) {
  return [...(list.history || []), snapshotBefore(list)].slice(-30);
}

function appendRedoHistory(list) {
  return [...(list.redoHistory || []), snapshotBefore(list)].slice(-30);
}

function summarize(list) {
  const players = activePlayers(list);
  const members = players.filter((player) => player.kind === "member");
  const guests = players.filter((player) => player.kind === "guest");
  const ghosts = players.filter((player) => player.kind === "ghost");
  const noShows = [
    ...(list.setters || []),
    ...(list.players || []),
  ].filter(
    (person) =>
      !players.some((player) => player.userId && player.userId === person.id),
  );

  return {
    totalPlayers: players.length,
    totalMembers: members.length,
    totalGuests: guests.length,
    totalGhosts: ghosts.length,
    totalGames: (list.games || []).length,
    totalWomen: players.filter((player) => player.sex === "female").length,
    totalSetters: players.filter((player) => player.isSetter).length,
    noShowsCount: noShows.length,
    noShows: noShows.map((person) => ({
      id: person.id,
      name: person.name || person.username || "Jogador",
      username: person.username || "",
    })),
    topWinners: [...players]
      .sort((a, b) => (b.stats?.wins || 0) - (a.stats?.wins || 0))
      .slice(0, 5)
      .map((player) => ({
        entryId: player.entryId,
        userId: player.userId || null,
        displayName: player.displayName,
        wins: player.stats?.wins || 0,
      })),
    mostGames: [...players]
      .sort((a, b) => (b.stats?.gamesPlayed || 0) - (a.stats?.gamesPlayed || 0))
      .slice(0, 5)
      .map((player) => ({
        entryId: player.entryId,
        userId: player.userId || null,
        displayName: player.displayName,
        gamesPlayed: player.stats?.gamesPlayed || 0,
      })),
  };
}

export async function getActiveVolleyList() {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("status", "in", ["open", "in_progress"]),
    limit(1),
  );

  const snapshot = await getDocs(q);
  const activeList = snapshot.docs[0];

  if (!activeList) return null;

  return {
    id: activeList.id,
    ...activeList.data(),
  };
}

export function subscribeActiveVolleyList({ onChange, onError }) {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("status", "in", ["open", "in_progress"]),
    limit(1),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const activeList = snapshot.docs[0];

      onChange(
        activeList
          ? {
              id: activeList.id,
              ...activeList.data(),
            }
          : null,
      );
    },
    onError,
  );
}

export async function getVolleyAdminUsers() {
  const snapshot = await getDocs(collection(db, "users"));

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
    }))
    .sort((a, b) =>
      (a.profile?.displayName || a.fullName || a.username || "").localeCompare(
        b.profile?.displayName || b.fullName || b.username || "",
      ),
    );
}

export async function createVolleyList({ date, adminUser }) {
  const activeList = await getActiveVolleyList();

  if (activeList) {
    throw new Error("Ja existe uma pelada em andamento. Encerre antes de abrir outra.");
  }

  const listRef = doc(collection(db, COLLECTION_NAME));

  const payload = {
    title: "Lista do Volei",
    date,
    status: "open",
    settersLimit: 4,
    playersLimit: 26,
    setters: [],
    players: [],
    guests: [],
    matchPlayers: [],
    teams: [],
    teamsFormedAt: null,
    returnTeam: null,
    games: [],
    history: [],
    redoHistory: [],
    womenRuleMode: "one",
    exitAfterTwoWins: true,
    summary: {
      totalPlayers: 0,
      totalMembers: 0,
      totalGuests: 0,
      totalGhosts: 0,
      totalGames: 0,
    },
    createdBy: adminUser.id,
    createdByName:
      adminUser.profile?.displayName || adminUser.fullName || adminUser.username,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await runTransaction(db, async (transaction) => {
    transaction.set(listRef, payload);
  });

  return {
    id: listRef.id,
    ...payload,
  };
}

export async function joinVolleyList({ listId, group, userData }) {
  const listRef = doc(db, COLLECTION_NAME, listId);
  const groupKey = getGroupKey(group);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);

    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();

    if (list.status !== "open") throw new Error("A lista nao esta aberta.");

    const currentUserGroup = getParticipantGroup(list, userData.id);

    if (currentUserGroup === group) throw new Error("Voce ja esta nesse grupo.");

    const nextGroups = removeParticipantFromGroups(list, userData.id);
    const currentGroup = nextGroups[groupKey] || [];
    const limitKey = group === "setter" ? "settersLimit" : "playersLimit";
    const groupLimit = list[limitKey] || 0;

    if (currentGroup.length >= groupLimit) throw new Error("Esse grupo ja esta cheio.");

    transaction.update(listRef, {
      ...nextGroups,
      [groupKey]: [...currentGroup, buildParticipant(userData)],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function leaveVolleyList({ listId, userId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);

    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const nextGroups = removeParticipantFromGroups(list, userId);

    transaction.update(listRef, {
      ...nextGroups,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function removeVolleyListParticipant({ listId, userId }) {
  return leaveVolleyList({ listId, userId });
}

export async function adminAddVolleyListParticipant({ listId, group, userData }) {
  const listRef = doc(db, COLLECTION_NAME, listId);
  const groupKey = getGroupKey(group);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const setters = list.confirmedSetters || list.setters || [];
    const players = list.confirmedPlayers || list.players || [];
    if ([...setters, ...players].some((person) => person.id === userData.id)) {
      throw new Error("Esse jogador ja esta na lista.");
    }

    const target = groupKey === "setters" ? setters : players;
    const limitKey = group === "setter" ? "settersLimit" : "playersLimit";
    if (target.length >= (list[limitKey] || 0)) throw new Error("Esse grupo ja esta cheio.");

    const nextSetters = groupKey === "setters" ? [...setters, buildParticipant(userData)] : setters;
    const nextPlayers = groupKey === "players" ? [...players, buildParticipant(userData)] : players;
    const update = {
      setters: nextSetters,
      players: nextPlayers,
      updatedAt: serverTimestamp(),
    };

    if (list.status === "in_progress") {
      update.confirmedSetters = nextSetters;
      update.confirmedPlayers = nextPlayers;
    }

    transaction.update(listRef, update);
  });
}

export async function adminRemoveVolleyListParticipant({ listId, userId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const setters = (list.confirmedSetters || list.setters || []).filter((person) => person.id !== userId);
    const players = (list.confirmedPlayers || list.players || []).filter((person) => person.id !== userId);
    const update = { setters, players, updatedAt: serverTimestamp() };

    if (list.status === "in_progress") {
      update.confirmedSetters = setters;
      update.confirmedPlayers = players;
    }

    transaction.update(listRef, update);
  });
}

export async function swapVolleyListParticipants({ listId, firstUserId, secondUserId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const groups = {
      setters: [...(list.confirmedSetters || list.setters || [])],
      players: [...(list.confirmedPlayers || list.players || [])],
    };
    const locate = (userId) => {
      for (const group of ["setters", "players"]) {
        const index = groups[group].findIndex((person) => person.id === userId);
        if (index >= 0) return { group, index };
      }
      return null;
    };
    const first = locate(firstUserId);
    const second = locate(secondUserId);

    if (!first || !second) throw new Error("Jogador nao encontrado na lista.");

    const firstPerson = groups[first.group][first.index];
    groups[first.group][first.index] = groups[second.group][second.index];
    groups[second.group][second.index] = firstPerson;

    const update = {
      setters: groups.setters,
      players: groups.players,
      updatedAt: serverTimestamp(),
    };
    if (list.status === "in_progress") {
      update.confirmedSetters = groups.setters;
      update.confirmedPlayers = groups.players;
    }
    transaction.update(listRef, update);
  });
}

export async function addVolleyMatchPlayer({ listId, userData, overrides = {} }) {
  const listRef = doc(db, COLLECTION_NAME, listId);
  const statsRef = userData.id ? doc(db, "user_stats", userData.id) : null;

  await runTransaction(db, async (transaction) => {
    const [listSnap, statsSnap] = await Promise.all([
      transaction.get(listRef),
      statsRef ? transaction.get(statsRef) : Promise.resolve(null),
    ]);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const currentPlayers = list.matchPlayers || [];
    const attendedUserIds = new Set([
      ...(list.attendedUserIds || []),
      ...currentPlayers.map((player) => player.userId).filter(Boolean),
    ]);

    if (
      userData.id &&
      currentPlayers.some((player) => !player.removedAt && player.userId === userData.id)
    ) {
      throw new Error("Esse jogador ja esta na pelada.");
    }

    const matchPlayer = buildMatchPlayerFromUser(
      userData,
      overrides,
      statsSnap?.exists() ? statsSnap.data() : {},
    );
    const nextList = {
      ...list,
      matchPlayers: [...currentPlayers, matchPlayer],
    };

    const teams = list.status === "in_progress" && list.teamsFormedAt
      ? addPlayerToTeams(nextList, matchPlayer.entryId)
      : list.teams || [];
    const shouldCreditAttendance = Boolean(
      userData.id && statsSnap?.exists() && !attendedUserIds.has(userData.id),
    );

    if (shouldCreditAttendance) {
      const persistedStats = statsSnap.data();
      const nextAttendance = Math.max(
        persistedStats.attendanceConfirmed || 0,
        persistedStats.matchesAttended || 0,
      ) + 1;

      transaction.update(statsRef, {
        attendanceConfirmed: nextAttendance,
        matchesAttended: nextAttendance,
        lastAttendedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      attendedUserIds.add(userData.id);
    }

    transaction.update(listRef, {
      matchPlayers: nextList.matchPlayers,
      attendedUserIds: [...attendedUserIds],
      teams,
      summary: summarize({ ...nextList, teams }),
      history: appendHistory(list),
      redoHistory: [],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function addGhostPlayer({ listId, displayName, sex = "male", isSetter = false }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  return runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const matchPlayer = {
      entryId: createId("ghost"),
      kind: "ghost",
      userId: null,
      displayName: displayName.trim(),
      username: "",
      sex,
      isSetter,
      addedAt: new Date().toISOString(),
      removedAt: null,
      stats: emptyPlayerStats(),
    };
    const nextList = {
      ...list,
      matchPlayers: [...(list.matchPlayers || []), matchPlayer],
    };
    const teams = list.status === "in_progress" && list.teamsFormedAt
      ? addPlayerToTeams(nextList, matchPlayer.entryId)
      : list.teams || [];

    transaction.update(listRef, {
      matchPlayers: nextList.matchPlayers,
      teams,
      summary: summarize({ ...nextList, teams }),
      history: appendHistory(list),
      redoHistory: [],
      updatedAt: serverTimestamp(),
    });

    return matchPlayer;
  });
}

export async function seedMockVolleyPlayers({ listId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();

    if (list.status !== "open") {
      throw new Error("Use o mock antes de montar os times.");
    }

    const now = new Date().toISOString();
    const realSetters = (list.setters || []).filter(
      (person) => !person.id?.startsWith("mock_"),
    );
    const realPlayers = (list.players || []).filter(
      (person) => !person.id?.startsWith("mock_"),
    );
    const realMatchPlayers = (list.matchPlayers || []).filter(
      (player) => !player.entryId?.startsWith("mock_"),
    );
    const settersToCreate = Math.max(0, (list.settersLimit || 4) - realSetters.length);
    const playersToCreate = Math.max(0, (list.playersLimit || 26) - realPlayers.length);
    let mockIndex = 0;

    function createMockPlayer(isSetter) {
      const entryId = createId("mock");
      const index = mockIndex;
      mockIndex += 1;
      return {
        entryId,
        kind: "ghost",
        userId: entryId,
        displayName: mockNames[index % mockNames.length],
        username: `teste${String(index + 1).padStart(2, "0")}`,
        sex: [1, 5, 9, 13, 17, 21, 25].includes(index) ? "female" : "male",
        isSetter,
        addedAt: now,
        removedAt: null,
        stats: emptyPlayerStats(),
      };
    }

    const mockSetterPlayers = Array.from(
      { length: settersToCreate },
      () => createMockPlayer(true),
    );
    const mockRegularPlayers = Array.from(
      { length: playersToCreate },
      () => createMockPlayer(false),
    );
    const mockMatchPlayers = [...mockSetterPlayers, ...mockRegularPlayers];
    const mockSetters = mockSetterPlayers.map((player) => ({
      id: player.entryId,
      name: player.displayName,
      username: player.username,
      role: "guest",
      sex: player.sex,
    }));
    const mockPlayers = mockRegularPlayers.map((player) => ({
      id: player.entryId,
      name: player.displayName,
      username: player.username,
      role: "guest",
      sex: player.sex,
    }));
    const setters = [...realSetters, ...mockSetters];
    const players = [...realPlayers, ...mockPlayers];
    const matchPlayers = [...realMatchPlayers, ...mockMatchPlayers];
    const mockProfiles = mockMatchPlayers.reduce((profiles, player, index) => ({
      ...profiles,
      [player.userId]: buildMockProfileBundle(player, index),
    }), {});
    const nextList = {
      ...list,
      setters,
      players,
      matchPlayers,
      mockProfiles,
      teams: [],
      returnTeam: null,
      games: [],
    };

    transaction.update(listRef, {
      setters,
      players,
      matchPlayers,
      mockProfiles,
      teams: [],
      returnTeam: null,
      games: [],
      history: appendHistory(list),
      redoHistory: [],
      summary: summarize(nextList),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateMatchPlayerFlags({ listId, entryId, sex, isSetter }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const currentPlayer = (list.matchPlayers || []).find(
      (player) => player.entryId === entryId,
    );
    if (!currentPlayer) throw new Error("Jogador nao encontrado.");

    const updatedPlayer = {
      ...currentPlayer,
      sex: sex || currentPlayer.sex,
      isSetter: typeof isSetter === "boolean" ? isSetter : currentPlayer.isSetter,
    };
    const matchPlayers = (list.matchPlayers || []).map((player) =>
      player.entryId === entryId
        ? updatedPlayer
        : player,
    );
    const teams = (list.teams || []).map((team) => ({
      ...team,
      players: [...(team.players || [])],
    }));
    const sourceTeamIndex = teams.findIndex((team) => team.players.includes(entryId));
    const becameSetter = !currentPlayer.isSetter && updatedPlayer.isSetter;
    const becameWoman = currentPlayer.sex !== "female"
      && updatedPlayer.sex === "female"
      && !updatedPlayer.isSetter;

    if (sourceTeamIndex >= 2 && (becameSetter || becameWoman)) {
      const targetTeamIndex = teams.findIndex((team, index) => {
        if (index < 2 || index >= sourceTeamIndex) return false;
        if ((team.players || []).length >= TEAM_SIZE) return false;

        const teamPlayers = (team.players || [])
          .map((playerEntryId) => matchPlayers.find((player) => player.entryId === playerEntryId))
          .filter(Boolean);

        if (becameSetter) {
          const hasSetter = teamPlayers.some((player) => player.isSetter)
            || team.players.includes(team.temporarySetterEntryId);
          return !hasSetter;
        }

        const womenLimit = (team.womenRuleMode || list.womenRuleMode || "one") === "two"
          ? 2
          : 1;
        const womenCount = teamPlayers.filter((player) => (
          player.sex === "female"
          && !player.isSetter
          && player.entryId !== team.temporarySetterEntryId
        )).length;
        return womenCount < womenLimit;
      });

      if (targetTeamIndex >= 0) {
        const sourceTeam = teams[sourceTeamIndex];
        sourceTeam.players = sourceTeam.players.filter((playerEntryId) => playerEntryId !== entryId);
        if (sourceTeam.temporarySetterEntryId === entryId) {
          sourceTeam.temporarySetterEntryId = null;
        }
        teams[targetTeamIndex].players.push(entryId);
      }
    }

    transaction.update(listRef, {
      matchPlayers,
      teams,
      summary: summarize({ ...list, matchPlayers, teams }),
      history: appendHistory(list),
      redoHistory: [],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function startVolleyMatch({ listId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    transaction.update(listRef, {
      status: "in_progress",
      confirmedSetters: asPlain(list.setters || []),
      confirmedPlayers: asPlain(list.players || []),
      confirmationFrozenAt: serverTimestamp(),
      matchPlayers: [],
      teams: [],
      returnTeam: null,
      teamsFormedAt: null,
      history: [],
      redoHistory: [],
      summary: summarize({ ...list, matchPlayers: [], teams: [] }),
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function formInitialVolleyTeams({ listId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const arrivals = activePlayers(list);
    if (list.status !== "in_progress") throw new Error("A pelada ainda nao iniciou.");
    if (list.teamsFormedAt) throw new Error("Os times ja foram montados.");
    if (arrivals.length < 12) throw new Error("E preciso ter 12 jogadores presentes.");

    let teams = buildInitialTeams(list, arrivals);
    arrivals.slice(TEAM_SIZE * 2).forEach((player) => {
      teams = addPlayerToTeams({ ...list, teams }, player.entryId);
    });

    transaction.update(listRef, {
      teams,
      returnTeam: null,
      teamsFormedAt: serverTimestamp(),
      summary: summarize({ ...list, teams }),
      history: appendHistory(list),
      redoHistory: [],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function toggleVolleyRule({ listId, rule, value }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");
    const list = listSnap.data();
    const update = {
      [rule]: value,
      history: appendHistory(list),
      redoHistory: [],
      updatedAt: serverTimestamp(),
    };

    if (rule === "womenRuleMode") {
      const currentMode = list.womenRuleMode || "one";
      update.teams = adaptWaitingTeamsForWomenRule(list, value);
      update.returnTeam = list.returnTeam
        ? {
            ...list.returnTeam,
            womenRuleMode: list.returnTeam.womenRuleMode || currentMode,
          }
        : null;
    }

    transaction.update(listRef, update);
  });
}

export async function swapMatchPlayers({ listId, firstEntryId, secondEntryId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const swapInTeam = (team) => {
      let temporarySetterEntryId = team.temporarySetterEntryId || null;
      const temporaryWomanEntryIds = (team.temporaryWomanEntryIds || []).map((entryId) => {
        if (entryId === firstEntryId) return secondEntryId;
        if (entryId === secondEntryId) return firstEntryId;
        return entryId;
      });
      if (temporarySetterEntryId === firstEntryId) {
        temporarySetterEntryId = secondEntryId;
      } else if (temporarySetterEntryId === secondEntryId) {
        temporarySetterEntryId = firstEntryId;
      }

      return {
        ...team,
        temporarySetterEntryId,
        temporaryWomanEntryIds,
        players: (team.players || []).map((entryId) => {
        if (entryId === firstEntryId) return secondEntryId;
        if (entryId === secondEntryId) return firstEntryId;
        return entryId;
        }),
      };
    };

    const teams = (list.teams || []).map(swapInTeam);
    const returnTeam = list.returnTeam ? swapInTeam(list.returnTeam) : null;
    const matchPlayers = [...(list.matchPlayers || [])];
    const firstIndex = matchPlayers.findIndex((player) => player.entryId === firstEntryId);
    const secondIndex = matchPlayers.findIndex((player) => player.entryId === secondEntryId);
    if (firstIndex >= 0 && secondIndex >= 0) {
      [matchPlayers[firstIndex], matchPlayers[secondIndex]] = [matchPlayers[secondIndex], matchPlayers[firstIndex]];
    }

    transaction.update(listRef, {
      teams,
      returnTeam,
      matchPlayers,
      history: appendHistory(list),
      redoHistory: [],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function moveMatchPlayerToTeamVacancy({ listId, entryId, targetTeamId, slotType }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const player = getPlayer(list, entryId);
    if (!player || player.removedAt) throw new Error("Jogador nao encontrado.");

    let targetFound = false;
    const moveIntoTeam = (team) => {
      const alreadyInTarget = (team.players || []).includes(entryId);
      const players = (team.players || []).filter((id) => id !== entryId);

      if (team.id !== targetTeamId) {
        return {
          ...team,
          players,
          temporarySetterEntryId: team.temporarySetterEntryId === entryId
            ? null
            : team.temporarySetterEntryId || null,
          temporaryWomanEntryIds: (team.temporaryWomanEntryIds || []).filter(
            (id) => id !== entryId,
          ),
        };
      }

      targetFound = true;
      if (!alreadyInTarget && players.length >= TEAM_SIZE) {
        throw new Error("Esse time nao possui vaga disponivel.");
      }

      return {
        ...team,
        players: [...players, entryId],
        temporarySetterEntryId: slotType === "setter" && !player.isSetter
          ? entryId
          : team.temporarySetterEntryId === entryId
            ? null
            : team.temporarySetterEntryId || null,
        temporaryWomanEntryIds: slotType === "woman" && player.sex !== "female"
          ? [...new Set([...(team.temporaryWomanEntryIds || []).filter((id) => id !== entryId), entryId])]
          : (team.temporaryWomanEntryIds || []).filter((id) => id !== entryId),
      };
    };

    const teams = (list.teams || []).map(moveIntoTeam);
    const returnTeam = list.returnTeam ? moveIntoTeam(list.returnTeam) : null;
    if (!targetFound) throw new Error("Time de destino nao encontrado.");

    transaction.update(listRef, {
      teams,
      returnTeam,
      summary: summarize({ ...list, teams, returnTeam }),
      history: appendHistory(list),
      redoHistory: [],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function removeMatchPlayer({ listId, entryId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const now = new Date().toISOString();
    const matchPlayers = (list.matchPlayers || []).map((player) =>
      player.entryId === entryId ? { ...player, removedAt: now } : player,
    );
    const removed = removeEntryEverywhere(list, entryId);

    transaction.update(listRef, {
      matchPlayers,
      teams: removed.teams,
      returnTeam: removed.returnTeam?.players?.length ? removed.returnTeam : null,
      summary: summarize({ ...list, matchPlayers, teams: removed.teams }),
      history: appendHistory(list),
      redoHistory: [],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function recordTeamWin({ listId, winningTeamIndex }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const teams = (list.teams || []).map((team) => ({
      ...team,
      players: [...(team.players || [])],
      temporarySetterEntryId: team.temporarySetterEntryId || null,
    }));

    if (teams.length < 2) throw new Error("E preciso ter dois times em quadra.");

    const losingTeamIndex = winningTeamIndex === 0 ? 1 : 0;
    const winningTeam = teams[winningTeamIndex];
    const losingTeam = teams[losingTeamIndex];
    if (!winningTeam || !losingTeam) throw new Error("Time invalido.");

    const playersBeforeResult = list.matchPlayers || [];
    const resultEntryIds = new Set([
      ...(winningTeam.players || []),
      ...(losingTeam.players || []),
    ]);
    const resultPlayers = playersBeforeResult.filter(
      (player) => resultEntryIds.has(player.entryId) && player.userId,
    );
    const uniqueUserIds = [...new Set(resultPlayers.map((player) => player.userId))];
    const statsSnapshots = await Promise.all(
      uniqueUserIds.map((userId) => transaction.get(doc(db, "user_stats", userId))),
    );
    const persistedStatsByUserId = new Map(
      statsSnapshots
        .filter((statsSnap) => statsSnap.exists())
        .map((statsSnap) => [statsSnap.id, statsSnap.data()]),
    );

    resultPlayers.forEach((player) => {
      const persistedStats = persistedStatsByUserId.get(player.userId);
      if (!persistedStats) return;

      const isWinner = winningTeam.players.includes(player.entryId);
      const matchesPlayed = Math.max(
        persistedStats.matchesPlayed || 0,
        persistedStats.gamesPlayed || 0,
      ) + 1;
      const statsUpdate = {
        matchesPlayed,
        gamesPlayed: matchesPlayed,
        setterGames: (persistedStats.setterGames || 0) + (player.isSetter ? 1 : 0),
        lastPlayedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (isWinner) {
        const currentStreak = Math.max(
          persistedStats.currentStreak || 0,
          persistedStats.currentWinStreak || 0,
        ) + 1;
        const bestStreak = Math.max(
          persistedStats.bestStreak || 0,
          persistedStats.bestDailyWinStreak || 0,
          currentStreak,
        );
        const sequenceMilestoneHits = {
          ...(persistedStats.sequenceMilestoneHits || {}),
        };

        if (sequenceMilestones.includes(currentStreak)) {
          sequenceMilestoneHits[currentStreak] =
            (sequenceMilestoneHits[currentStreak] || 0) + 1;
        }

        Object.assign(statsUpdate, {
          wins: (persistedStats.wins || 0) + 1,
          setterWins: (persistedStats.setterWins || 0) + (player.isSetter ? 1 : 0),
          currentStreak,
          currentWinStreak: currentStreak,
          bestStreak,
          bestDailyWinStreak: bestStreak,
          sequenceMilestoneHits,
        });
      } else {
        Object.assign(statsUpdate, {
          losses: (persistedStats.losses || 0) + 1,
          currentStreak: 0,
          currentWinStreak: 0,
        });
      }

      transaction.update(doc(db, "user_stats", player.userId), statsUpdate);
    });

    const matchPlayers = (list.matchPlayers || []).map((player) => {
      if (winningTeam.players.includes(player.entryId)) {
        const stats = player.stats || emptyPlayerStats();
        const nextStreak = (stats.currentWinStreak || 0) + 1;
        const sequenceMilestoneHits = { ...(stats.sequenceMilestoneHits || {}) };

        if (sequenceMilestones.includes(nextStreak)) {
          sequenceMilestoneHits[nextStreak] =
            (sequenceMilestoneHits[nextStreak] || 0) + 1;
        }

        return {
          ...player,
          stats: {
            ...stats,
            gamesPlayed: (stats.gamesPlayed || 0) + 1,
            wins: (stats.wins || 0) + 1,
            setterGames: (stats.setterGames || 0) + (player.isSetter ? 1 : 0),
            setterWins: (stats.setterWins || 0) + (player.isSetter ? 1 : 0),
            currentWinStreak: nextStreak,
            bestWinStreak: Math.max(stats.bestWinStreak || 0, nextStreak),
            sequenceMilestoneHits,
          },
        };
      }

      if (losingTeam.players.includes(player.entryId)) {
        const stats = player.stats || emptyPlayerStats();

        return {
          ...player,
          stats: {
            ...stats,
            gamesPlayed: (stats.gamesPlayed || 0) + 1,
            losses: (stats.losses || 0) + 1,
            setterGames: (stats.setterGames || 0) + (player.isSetter ? 1 : 0),
            currentWinStreak: 0,
          },
        };
      }

      return player;
    });

    const listWithStats = {
      ...list,
      matchPlayers,
    };
    let nextTeams = teams.filter((_, index) => index !== losingTeamIndex);
    const nextWinningTeamIndex = losingTeamIndex < winningTeamIndex ? winningTeamIndex - 1 : winningTeamIndex;
    nextTeams[nextWinningTeamIndex] = {
      ...nextTeams[nextWinningTeamIndex],
      wins: (winningTeam.wins || 0) + 1,
    };
    let returnTeam = list.returnTeam
      ? {
          ...list.returnTeam,
          temporarySetterEntryId: list.returnTeam.temporarySetterEntryId || null,
        }
      : null;

    nextTeams = redistributeLoser(listWithStats, nextTeams, losingTeam);

    if (list.exitAfterTwoWins) {
      if (returnTeam) {
        returnTeam = {
          ...returnTeam,
          wins: 0,
        };
        nextTeams = nextTeams.filter((team) => team.id !== losingTeam.id);
        nextTeams.unshift(returnTeam);
        returnTeam = null;
      } else {
        const currentWinner = nextTeams.find((team) => team.id === winningTeam.id);

        if ((currentWinner?.wins || 0) >= 2) {
          returnTeam = {
            ...currentWinner,
            players: [...currentWinner.players],
            wins: currentWinner.wins,
          };
          nextTeams = nextTeams.filter((team) => team.id !== winningTeam.id);
          matchPlayers.forEach((player) => {
            if (returnTeam.players.includes(player.entryId)) {
              player.stats.returnTeamAppearances =
                (player.stats.returnTeamAppearances || 0) + 1;
            }
          });
        }
      }
    }

    const game = {
      id: createId("game"),
      index: (list.games || []).length + 1,
      winnerTeamId: winningTeam.id,
      loserTeamId: losingTeam.id,
      winnerPlayers: winningTeam.players,
      loserPlayers: losingTeam.players,
      createdAt: new Date().toISOString(),
    };
    const games = [...(list.games || []), game];

    transaction.update(listRef, {
      matchPlayers,
      teams: nextTeams,
      returnTeam,
      games,
      summary: summarize({ ...listWithStats, teams: nextTeams, returnTeam, games }),
      history: appendHistory(list),
      redoHistory: [],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function undoVolleyListAction({ listId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const history = list.history || [];
    const last = history[history.length - 1];

    if (!last) throw new Error("Nao ha acao para desfazer.");

    await syncPersistedAttendance({
      transaction,
      fromUserIds: list.attendedUserIds,
      toUserIds: last.attendedUserIds,
    });

    const currentGames = list.games || [];
    const previousGames = last.games || [];
    if (currentGames.length === previousGames.length + 1) {
      await syncPersistedGameStats({
        transaction,
        beforePlayers: last.matchPlayers || [],
        afterPlayers: list.matchPlayers || [],
        game: currentGames[currentGames.length - 1],
        direction: -1,
      });
    }

    transaction.update(listRef, {
      teams: last.teams || [],
      teamsFormedAt: last.teamsFormed ? list.teamsFormedAt || serverTimestamp() : null,
      returnTeam: last.returnTeam || null,
      matchPlayers: last.matchPlayers || [],
      games: last.games || [],
      attendedUserIds: last.attendedUserIds || list.attendedUserIds || [],
      summary: last.summary || {},
      womenRuleMode: last.womenRuleMode || "one",
      exitAfterTwoWins: last.exitAfterTwoWins !== false,
      history: history.slice(0, -1),
      redoHistory: appendRedoHistory(list),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function redoVolleyListAction({ listId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const redoHistory = list.redoHistory || [];
    const next = redoHistory[redoHistory.length - 1];
    if (!next) throw new Error("Nao ha acao para refazer.");

    await syncPersistedAttendance({
      transaction,
      fromUserIds: list.attendedUserIds,
      toUserIds: next.attendedUserIds,
    });

    const currentGames = list.games || [];
    const nextGames = next.games || [];
    if (nextGames.length === currentGames.length + 1) {
      await syncPersistedGameStats({
        transaction,
        beforePlayers: list.matchPlayers || [],
        afterPlayers: next.matchPlayers || [],
        game: nextGames[nextGames.length - 1],
        direction: 1,
      });
    }

    transaction.update(listRef, {
      teams: next.teams || [],
      teamsFormedAt: next.teamsFormed ? list.teamsFormedAt || serverTimestamp() : null,
      returnTeam: next.returnTeam || null,
      matchPlayers: next.matchPlayers || [],
      games: next.games || [],
      attendedUserIds: next.attendedUserIds || list.attendedUserIds || [],
      summary: next.summary || {},
      womenRuleMode: next.womenRuleMode || "one",
      exitAfterTwoWins: next.exitAfterTwoWins !== false,
      history: appendHistory(list),
      redoHistory: redoHistory.slice(0, -1),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function finishVolleyList({ listId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);
  const reportRef = doc(db, "volley_reports", listId);
  const metricsRef = doc(db, "app_metrics", "volley");

  const finalized = await runTransaction(db, async (transaction) => {
    const [listSnap, reportSnap, metricsSnap] = await Promise.all([
      transaction.get(listRef),
      transaction.get(reportRef),
      transaction.get(metricsRef),
    ]);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");
    if (reportSnap.exists() || listSnap.data().status === "closed") return false;

    const list = listSnap.data();
    const finalSummary = summarize(list);
    const ranking = activePlayers(list)
      .map((player) => ({
        entryId: player.entryId,
        userId: player.userId || null,
        displayName: player.displayName || "Jogador",
        sex: player.sex || "male",
        isSetter: Boolean(player.isSetter),
        wins: player.stats?.wins || 0,
        gamesPlayed: player.stats?.gamesPlayed || 0,
        profileBundle: list.mockProfiles?.[player.userId] || null,
      }));
    const winsRanking = [...ranking].sort(
      (first, second) => second.wins - first.wins
        || second.gamesPlayed - first.gamesPlayed
        || first.displayName.localeCompare(second.displayName),
    );
    const reportSummary = {
      totalGames: finalSummary.totalGames,
      totalPlayers: finalSummary.totalPlayers,
    };
    const finalState = {
      teams: list.teams || [],
      returnTeam: list.returnTeam || null,
    };

    transaction.update(listRef, {
      status: "closed",
      summary: finalSummary,
      finalState,
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(reportRef, {
      listId,
      date: list.date || "",
      summary: reportSummary,
      winsRanking,
      createdBy: list.createdBy || null,
      closedAt: serverTimestamp(),
    });

    const metrics = metricsSnap.exists() ? metricsSnap.data() : {};
    transaction.set(metricsRef, {
      totalDays: (metrics.totalDays || 0) + 1,
      totalGames: (metrics.totalGames || 0) + finalSummary.totalGames,
      totalAttendances: deleteField(),
      lastReportId: listId,
      lastDate: list.date || "",
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return true;
  });

  if (!finalized) return;

  const closedListSnap = await getDoc(listRef);
  const data = closedListSnap.exists() ? closedListSnap.data() : null;
  const batch = writeBatch(db);
  const noShowIds = new Set((data?.summary?.noShows || []).map((person) => person.id));

  noShowIds.forEach((userId) => {
    batch.set(
      doc(db, "user_stats", userId),
      {
        noShows: increment(1),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  await batch.commit();
}
