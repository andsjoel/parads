export const DAILY_CONSOLATION_VERSION = 1;

export function getDailyConsolationReward(games, losses) {
  if (!Number.isSafeInteger(games) || !Number.isSafeInteger(losses)
    || games < 3 || losses < 0 || losses > games) return 0;
  if (games >= 5 && losses === games) return 3;
  if (losses * 100 >= games * 80) return 2;
  return losses * 100 >= games * 65 ? 1 : 0;
}

export function dailyConsolationPostId(listId) {
  if (typeof listId !== "string" || !listId || listId.includes("/")) throw Error("Lista inválida.");
  return `daily-consolation_${listId}`;
}

export function buildDailyConsolationRecipients(list) {
  const players = new Map((list.matchPlayers || []).map((p) => [p.entryId, p]));
  const totals = new Map();
  const seen = new Set();
  for (const game of list.games || []) {
    if (!game.id || seen.has(game.id)) throw Error("Histórico de partidas inválido.");
    seen.add(game.id);
    const winners = game.winnerPlayers || [], losers = game.loserPlayers || [];
    if (new Set([...winners, ...losers]).size !== winners.length + losers.length) {
      throw Error("Jogador duplicado na mesma partida.");
    }
    const counted = new Set();
    for (const [ids, lost] of [[winners, false], [losers, true]]) {
      for (const entryId of ids) {
        const uid = players.get(entryId)?.userId;
        // Unprovisioned legacy guests have no account to receive coins.
        if (!uid || uid.startsWith("mock_")) continue;
        if (counted.has(uid)) throw Error("Conta duplicada na mesma partida.");
        counted.add(uid);
        const value = totals.get(uid) || { games: 0, losses: 0 };
        value.games++;
        if (lost) value.losses++;
        totals.set(uid, value);
      }
    }
  }
  return Object.fromEntries([...totals].flatMap(([uid, value]) => {
    const reward = getDailyConsolationReward(value.games, value.losses);
    return reward ? [[uid, { ...value, reward }]] : [];
  }));
}

export function buildDailyConsolationPost(list, listId) {
  const recipients = buildDailyConsolationRecipients(list);
  if (!Object.keys(recipients).length) return null;
  return {
    kind: "daily_reward", type: "daily_consolation", title: "Dia ruim?",
    reportId: listId, createdBy: list.createdBy || null,
    payload: { version: DAILY_CONSOLATION_VERSION, listId, date: list.date, recipients },
  };
}
