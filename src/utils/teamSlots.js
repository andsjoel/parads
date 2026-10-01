export function buildTeamDisplaySlots({ team, playersByEntryId, womenRuleMode = "one" }) {
  const playerIds = Array.isArray(team?.players) ? team.players : [];
  const playerLookup = playersByEntryId && typeof playersByEntryId === "object"
    ? playersByEntryId
    : {};
  const teamPlayers = playerIds.map((entryId) => playerLookup[entryId]).filter(Boolean);
  const setter = teamPlayers.find((player) => player.isSetter)
    || teamPlayers.find((player) => player.entryId === team?.temporarySetterEntryId)
    || null;
  const isTemporarySetter = Boolean(
    setter
    && !setter.isSetter
    && setter.entryId === team?.temporarySetterEntryId,
  );
  const womenLimit = womenRuleMode === "two" ? 2 : 1;
  const temporaryWomanIds = new Set(team?.temporaryWomanEntryIds || []);
  const women = teamPlayers.filter((player) => (
      player.entryId !== setter?.entryId
      && !player.isSetter
      && (player.sex === "female" || temporaryWomanIds.has(player.entryId))
    ));
  const reservedEntryIds = new Set([
    setter?.entryId,
    ...women.map((player) => player.entryId),
  ].filter(Boolean));
  const regularPlayers = teamPlayers.filter(
    (player) => !reservedEntryIds.has(player.entryId),
  );
  let availableVacancies = Math.max(0, 6 - teamPlayers.length);
  const slots = [];

  if (setter) {
    slots.push({
      player: setter,
      label: "Vaga levantador",
      type: "setter",
      displayAsSetter: isTemporarySetter,
    });
  } else if (availableVacancies > 0) {
    slots.push({
      player: null,
      label: "Vaga levantador",
      type: "setter",
      displayAsSetter: false,
    });
    availableVacancies -= 1;
  }

  slots.push(
    ...women.map((player) => ({
      player,
      label: "Vaga mulher",
      type: "woman",
      displayAsSetter: false,
    })),
    ...Array.from({
      length: Math.min(
        availableVacancies,
        Math.max(0, womenLimit - women.length),
      ),
    }, () => ({
      player: null,
      label: "Vaga mulher",
      type: "woman",
      displayAsSetter: false,
    })),
  );

  regularPlayers.forEach((player) => {
    slots.push({ player, label: "Vaga", type: "default", displayAsSetter: false });
  });
  while (slots.length < 6) {
    slots.push({ player: null, label: "Vaga", type: "default", displayAsSetter: false });
  }

  return slots.slice(0, 6);
}
