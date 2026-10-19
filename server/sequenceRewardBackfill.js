import { createHash } from "node:crypto";
import {
  sequenceMilestones, getPendingSequenceRewards, getClaimedSequenceRewardAmount,
} from "../src/data/profileMissions.js";

const LEGACY_REWARDS = { 2: 1, 5: 2, 10: 3, 15: 4, 20: 5 };
const NEW_THRESHOLDS = sequenceMilestones.filter((value) => !(value in LEGACY_REWARDS));
export const SEQUENCE_BACKFILL_VERSION = "sequence-rewards-v2";
export const SEQUENCE_BACKFILL_PROJECT = "parads-app-26f23";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
  );
  return value;
}

export function backfillDigest(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function snapshotVersion(snapshot) {
  const time = snapshot.updateTime;
  return typeof time === "string" ? time : time ? `${time.seconds}:${time.nanoseconds}` : null;
}

function validId(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 128 && !id.includes("/");
}

function startingStreak(list, games, event, player) {
  if (!event.won) return 0;
  const before = (list.history || []).filter((snapshot) => {
    const past = snapshot.games || [];
    return past.length <= event.index
      && past.every((game, i) => game.id === games[i]?.id)
      && (snapshot.matchPlayers || []).some((item) => item.entryId === player.entryId);
  }).sort((a, b) => (b.games || []).length - (a.games || []).length);
  for (const snapshot of before) {
    const value = snapshot.matchPlayers.find((item) => item.entryId === player.entryId)?.stats?.currentWinStreak;
    if (Number.isSafeInteger(value) && value >= 0) return value;
  }
  // Without a preceding snapshot, a run containing a loss cannot reveal its starting streak.
  throw new Error("Falta snapshot anterior à primeira vitória; não é seguro presumir sequência inicial zero.");
}

export function buildSequenceBackfill({ list, listId, date, listUpdateTime, statsByUserId }) {
  if (!validId(listId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || list.date !== date) throw Error("Lista/data inválida.");
  const games = list.games || [];
  if (!games.length || games.length > 500) throw Error("Quantidade de partidas fora do escopo seguro.");
  const players = new Map();
  for (const player of list.matchPlayers || []) {
    if (!validId(player.entryId) || players.has(player.entryId)) throw Error("Identificador de jogador inválido ou duplicado.");
    players.set(player.entryId, player);
  }
  const events = new Map(), gameIds = new Set();
  games.forEach((game, index) => {
    if (!validId(game.id) || gameIds.has(game.id) || game.index !== index + 1) throw Error("Ordem/identificação das partidas inconsistente.");
    gameIds.add(game.id);
    if (![game.winnerPlayers, game.loserPlayers].every((ids) => Array.isArray(ids) && ids.length > 0 && ids.length <= 6)) throw Error("Partida sem escalações válidas.");
    const seenEntries = new Set(), seenUsers = new Set();
    for (const [won, ids] of [[true, game.winnerPlayers], [false, game.loserPlayers]]) {
      for (const id of ids) {
        const player = players.get(id);
        if (!player || seenEntries.has(id)) throw Error("Escalação sem jogador correspondente ou duplicada.");
        seenEntries.add(id);
        if (!player.userId) continue;
        if (!validId(player.userId) || seenUsers.has(player.userId)) throw Error("Conta duplicada ou inválida na partida.");
        seenUsers.add(player.userId);
        if (!events.has(player.userId)) events.set(player.userId, []);
        events.get(player.userId).push({ index, won, player });
      }
    }
  });
  if (events.size > 100) throw Error("Mais de 100 participantes; revisão manual necessária.");
  const migrationId = `sequence-v2-${date}`;
  const sourceHash = backfillDigest({ listId, date, games, matchPlayers: list.matchPlayers, history: list.history || [] });
  const entries = [], blocked = [];
  for (const [uid, results] of events) {
    const name = results[0].player.displayName || uid;
    try {
      const record = statsByUserId.get(uid);
      if (!record?.stats || !record.updateTime) throw Error("Estatísticas ou versão do documento ausentes.");
      const stats = record.stats;
      if (stats.sequenceRewardBackfills?.[migrationId]) {
        entries.push({ uid, name, alreadyApplied: true });
        continue;
      }
      const beforeHits = { ...(stats.sequenceMilestoneHits || {}) };
      for (const threshold of NEW_THRESHOLDS) {
        if ((beforeHits[threshold] || 0) !== 0 || (stats.claimedSequenceMilestoneHits?.[threshold] || 0) !== 0
          || (stats.claimedSequenceRewardAmounts?.[threshold] || 0) !== 0) {
          throw Error("Novos marcos já possuem movimentação sem identificação deste ajuste; revisão necessária.");
        }
      }
      let streak = startingStreak(list, games, results[0], results[0].player);
      const hits = {};
      for (const result of results) {
        streak = result.won ? streak + 1 : 0;
        if (result.won && sequenceMilestones.includes(streak)) hits[streak] = (hits[streak] || 0) + 1;
      }
      for (const threshold of [2, 5, 10]) {
        if ((hits[threshold] || 0) > (beforeHits[threshold] || 0)) throw Error("Histórico e marcos antigos divergem; revisão necessária.");
      }
      const addedHits = Object.fromEntries(NEW_THRESHOLDS.filter((key) => hits[key]).map((key) => [key, hits[key]]));
      const afterHits = { ...beforeHits, ...addedHits };
      const pendingBefore = Object.entries(LEGACY_REWARDS).reduce((total, [key, reward]) =>
        total + Math.max(0, (beforeHits[key] || 0) * reward - getClaimedSequenceRewardAmount(stats, key)), 0);
      const pendingAfter = getPendingSequenceRewards({ ...stats, sequenceMilestoneHits: afterHits })
        .reduce((total, item) => total + item.totalReward, 0);
      entries.push({ uid, name, statsUpdateTime: record.updateTime, beforeHits, afterHits, addedHits,
        pendingBefore, pendingAfter, additionalCoins: pendingAfter - pendingBefore });
    } catch (error) {
      blocked.push({ uid, name, reason: error.message });
    }
  }
  return {
    version: SEQUENCE_BACKFILL_VERSION, projectId: SEQUENCE_BACKFILL_PROJECT,
    migrationId, date, listId, listUpdateTime, sourceHash, games: games.length, entries, blocked,
    summary: {
      participants: events.size, alreadyApplied: entries.filter((item) => item.alreadyApplied).length,
      additionalCoins: entries.reduce((total, item) => total + (item.additionalCoins || 0), 0),
      playersWithAdditionalCoins: entries.filter((item) => item.additionalCoins > 0).length,
    },
  };
}

export function sealBackfillPlan(plan) {
  return { ...plan, digest: backfillDigest(plan) };
}

export async function applySequenceBackfill(db, manifest, approvedDigest, serverTimestamp) {
  const { digest, ...plan } = manifest;
  if (digest !== approvedDigest || digest !== backfillDigest(plan)) throw Error("Hash da prévia não confere.");
  if (db.projectId !== SEQUENCE_BACKFILL_PROJECT || plan.projectId !== db.projectId
    || plan.version !== SEQUENCE_BACKFILL_VERSION || !validId(plan.listId)
    || plan.blocked?.length || !Array.isArray(plan.entries) || !plan.entries.length || plan.entries.length > 100
    || !plan.entries.every((item) => validId(item.uid)) || new Set(plan.entries.map((item) => item.uid)).size !== plan.entries.length) {
    throw Error("Plano/projeto inválido ou com participantes bloqueados.");
  }
  return db.runTransaction(async (transaction) => {
    const listSnapshot = await transaction.get(db.doc(`volley_lists/${plan.listId}`));
    const statsSnapshots = await Promise.all(plan.entries.map((item) => transaction.get(db.doc(`user_stats/${item.uid}`))));
    const statsByUserId = new Map(statsSnapshots.map((snapshot, index) => [plan.entries[index].uid,
      { stats: snapshot.data(), updateTime: snapshotVersion(snapshot) }]));
    const unapplied = plan.entries.filter((item) => !statsByUserId.get(item.uid)?.stats?.sequenceRewardBackfills?.[plan.migrationId]);
    if (!unapplied.length) return { applied: 0, skipped: plan.entries.length };
    if (snapshotVersion(listSnapshot) !== plan.listUpdateTime) throw Error("A lista mudou depois da prévia. Gere uma nova prévia.");
    const fresh = buildSequenceBackfill({ list: listSnapshot.data(), listId: plan.listId, date: plan.date,
      listUpdateTime: snapshotVersion(listSnapshot), statsByUserId });
    if (fresh.blocked.length || fresh.sourceHash !== plan.sourceHash) throw Error("Histórico alterado ou ambíguo; nenhuma gravação realizada.");
    for (const item of unapplied) {
      const expected = fresh.entries.find((entry) => entry.uid === item.uid);
      if (!expected || backfillDigest(item) !== backfillDigest(expected)) throw Error("Estatísticas/plano mudaram depois da prévia. Gere uma nova prévia.");
    }
    if (fresh.entries.length !== plan.entries.length) throw Error("Participantes mudaram depois da prévia.");
    for (const item of unapplied) {
      transaction.update(db.doc(`user_stats/${item.uid}`), {
        sequenceMilestoneHits: item.afterHits,
        [`sequenceRewardBackfills.${plan.migrationId}`]: {
          version: plan.version, sourceHash: plan.sourceHash, addedHits: item.addedHits, appliedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
    }
    return { applied: unapplied.length, skipped: plan.entries.length - unapplied.length };
  });
}
