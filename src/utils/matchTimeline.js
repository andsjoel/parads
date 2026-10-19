export function isTimelineDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function matchTimelinePath(date) {
  return isTimelineDate(date) ? `/matches-map?date=${encodeURIComponent(date)}` : "/matches-map";
}

export function mergeTimelineDays(...sources) {
  const days = new Map();
  for (const day of sources.flat()) {
    if (isTimelineDate(day?.date) && Number(day.totalGames) > 0) days.set(day.date, day);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function buildMatchTimeline(list) {
  const players = new Map((list?.matchPlayers || []).map((player) => [player.entryId, player]));
  const teams = new Map(), gameIds = new Set(), participants = new Set();
  function team(id) {
    if (!id) throw Error("Uma partida está sem identificação de equipe.");
    if (!teams.has(id)) teams.set(id, { id, index: teams.size, name: `Time ${teams.size + 1}`, wins: 0, losses: 0, appearances: [] });
    return teams.get(id);
  }
  function roster(ids) {
    if (!Array.isArray(ids) || !ids.length) throw Error("Uma partida está sem escalação.");
    return ids.map((id) => {
      const player = players.get(id);
      participants.add(player?.userId || id);
      return {
        entryId: id, name: player?.displayName || "Atleta indisponível",
        sex: player?.sex, isSetter: Boolean(player?.isSetter), isGuest: player?.kind === "guest",
      };
    });
  }
  const games = (list?.games || []).map((game, index) => {
    if (!game.id || gameIds.has(game.id) || game.index !== index + 1) throw Error("A ordem das partidas precisa ser revisada.");
    if (game.winnerTeamId === game.loserTeamId) throw Error("Uma partida possui a mesma equipe nos dois lados.");
    gameIds.add(game.id);
    const winner = team(game.winnerTeamId), loser = team(game.loserTeamId);
    winner.wins++;
    loser.losses++;
    winner.appearances.push(index);
    loser.appearances.push(index);
    return { id: game.id, index: game.index, recordedAt: game.createdAt,
      winner: { teamId: winner.id, players: roster(game.winnerPlayers) },
      loser: { teamId: loser.id, players: roster(game.loserPlayers) } };
  });
  return { games, teams: [...teams.values()], participants: participants.size };
}
