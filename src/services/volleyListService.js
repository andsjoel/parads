import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const COLLECTION_NAME = "volley_lists";
const TEAM_SIZE = 6;

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

function buildMatchPlayerFromUser(userData, overrides = {}) {
  const source = buildParticipant(userData);

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
    stats: emptyPlayerStats(),
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
    returnTeamAppearances: 0,
  };
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

  if ((team.players || []).length >= TEAM_SIZE) return false;
  if (player.isSetter && players.some((item) => item.isSetter)) return false;

  const womenCount = players.filter((item) => item.sex === "female").length;
  const womenLimit = list.womenRuleMode === "two" ? 2 : 1;

  if (player.sex === "female" && womenCount >= womenLimit) return false;

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
  });

  return teams;
}

function removeEntryFromTeamList(teams, entryId) {
  return (teams || [])
    .map((team) => ({
      ...team,
      players: (team.players || []).filter((id) => id !== entryId),
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

function redistributeLoser(list, teams, loserTeam) {
  const loserIds = loserTeam.players || [];
  const setters = loserIds.filter((id) => getPlayer(list, id)?.isSetter);
  const women = loserIds.filter((id) => {
    const player = getPlayer(list, id);
    return player?.sex === "female" && !player.isSetter;
  });
  const others = loserIds.filter((id) => {
    const player = getPlayer(list, id);
    return player && !player.isSetter && player.sex !== "female";
  });

  [...setters, ...women, ...shuffle(others)].forEach((entryId) => {
    teams = relocatePlayer(list, teams, entryId);
  });

  return teams;
}

function snapshotBefore(list) {
  return {
    teams: asPlain(list.teams || []),
    returnTeam: asPlain(list.returnTeam || null),
    matchPlayers: asPlain(list.matchPlayers || []),
    games: asPlain(list.games || []),
    summary: asPlain(list.summary || {}),
  };
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
    returnTeam: null,
    games: [],
    history: [],
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

export async function addVolleyMatchPlayer({ listId, userData, overrides = {} }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const currentPlayers = list.matchPlayers || [];

    if (
      userData.id &&
      currentPlayers.some((player) => !player.removedAt && player.userId === userData.id)
    ) {
      throw new Error("Esse jogador ja esta na pelada.");
    }

    const matchPlayer = buildMatchPlayerFromUser(userData, overrides);
    const nextList = {
      ...list,
      matchPlayers: [...currentPlayers, matchPlayer],
    };

    const teams = list.status === "in_progress"
      ? addPlayerToTeams(nextList, matchPlayer.entryId)
      : list.teams || [];

    transaction.update(listRef, {
      matchPlayers: nextList.matchPlayers,
      teams,
      summary: summarize({ ...nextList, teams }),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function addGhostPlayer({ listId, displayName, sex = "male", isSetter = false }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
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
    const teams = list.status === "in_progress"
      ? addPlayerToTeams(nextList, matchPlayer.entryId)
      : list.teams || [];

    transaction.update(listRef, {
      matchPlayers: nextList.matchPlayers,
      teams,
      summary: summarize({ ...nextList, teams }),
      updatedAt: serverTimestamp(),
    });
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
    const setters = Array.from({ length: 4 }).map((_, index) => ({
      entryId: createId("mock"),
      kind: "ghost",
      userId: null,
      displayName: `Levantador ${index + 1}`,
      username: "",
      sex: index === 1 ? "female" : "male",
      isSetter: true,
      addedAt: now,
      removedAt: null,
      stats: emptyPlayerStats(),
    }));
    const players = Array.from({ length: 26 }).map((_, index) => ({
      entryId: createId("mock"),
      kind: "ghost",
      userId: null,
      displayName: `Jogador ${String(index + 1).padStart(2, "0")}`,
      username: "",
      sex: [2, 7, 12, 17, 22].includes(index) ? "female" : "male",
      isSetter: false,
      addedAt: now,
      removedAt: null,
      stats: emptyPlayerStats(),
    }));
    const matchPlayers = [...setters, ...players];
    const nextList = {
      ...list,
      matchPlayers,
      teams: [],
      returnTeam: null,
      games: [],
    };

    transaction.update(listRef, {
      matchPlayers,
      teams: [],
      returnTeam: null,
      games: [],
      history: [snapshotBefore(list)],
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
    const matchPlayers = (list.matchPlayers || []).map((player) =>
      player.entryId === entryId
        ? {
            ...player,
            sex: sex || player.sex,
            isSetter: typeof isSetter === "boolean" ? isSetter : player.isSetter,
          }
        : player,
    );

    transaction.update(listRef, {
      matchPlayers,
      summary: summarize({ ...list, matchPlayers }),
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
    let teams = [];
    const nextList = {
      ...list,
      teams,
    };

    activePlayers(list).forEach((player) => {
      teams = addPlayerToTeams({ ...nextList, teams }, player.entryId);
    });

    transaction.update(listRef, {
      status: "in_progress",
      teams,
      returnTeam: null,
      summary: summarize({ ...list, teams }),
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function toggleVolleyRule({ listId, rule, value }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await updateDoc(listRef, {
    [rule]: value,
    updatedAt: serverTimestamp(),
  });
}

export async function swapMatchPlayers({ listId, firstEntryId, secondEntryId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const previous = snapshotBefore(list);

    const swapInTeam = (team) => ({
      ...team,
      players: (team.players || []).map((entryId) => {
        if (entryId === firstEntryId) return secondEntryId;
        if (entryId === secondEntryId) return firstEntryId;
        return entryId;
      }),
    });

    const teams = (list.teams || []).map(swapInTeam);
    const returnTeam = list.returnTeam ? swapInTeam(list.returnTeam) : null;

    transaction.update(listRef, {
      teams,
      returnTeam,
      history: [previous],
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
    const previous = snapshotBefore(list);
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
      history: [previous],
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
    }));

    if (teams.length < 2) throw new Error("E preciso ter dois times em quadra.");

    const losingTeamIndex = winningTeamIndex === 0 ? 1 : 0;
    const winningTeam = teams[winningTeamIndex];
    const losingTeam = teams[losingTeamIndex];
    const previous = snapshotBefore(list);
    const matchPlayers = (list.matchPlayers || []).map((player) => {
      if (winningTeam.players.includes(player.entryId)) {
        const stats = player.stats || emptyPlayerStats();
        const nextStreak = (stats.currentWinStreak || 0) + 1;

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
    let returnTeam = list.returnTeam || null;

    nextTeams = redistributeLoser(listWithStats, nextTeams, losingTeam);

    if (list.exitAfterTwoWins) {
      if (returnTeam) {
        returnTeam = {
          ...returnTeam,
          wins: returnTeam.wins || 0,
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
      history: [previous],
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
    const last = (list.history || [])[0];

    if (!last) throw new Error("Nao ha acao para desfazer.");

    transaction.update(listRef, {
      teams: last.teams || [],
      returnTeam: last.returnTeam || null,
      matchPlayers: last.matchPlayers || [],
      games: last.games || [],
      summary: last.summary || {},
      history: [],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function finishVolleyList({ listId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists()) throw new Error("Lista nao encontrada.");

    const list = listSnap.data();
    const finalSummary = summarize(list);
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
  });

  const closedListSnap = await getDoc(listRef);
  const data = closedListSnap.exists() ? closedListSnap.data() : null;
  const batch = writeBatch(db);
  const noShowIds = new Set((data?.summary?.noShows || []).map((person) => person.id));

  activePlayers(data || {})
    .filter((player) => player.kind === "member" && player.userId)
    .forEach((player) => {
      const stats = player.stats || emptyPlayerStats();
      const ref = doc(db, "user_stats", player.userId);

      batch.set(
        ref,
        {
          matchesAttended: increment(1),
          gamesPlayed: increment(stats.gamesPlayed || 0),
          wins: increment(stats.wins || 0),
          losses: increment(stats.losses || 0),
          setterGames: increment(stats.setterGames || 0),
          setterWins: increment(stats.setterWins || 0),
          bestDailyWins: stats.wins || 0,
          bestDailyWinStreak: stats.bestWinStreak || 0,
          lastPlayedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

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
