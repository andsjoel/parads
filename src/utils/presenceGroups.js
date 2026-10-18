export const PRESENCE_LIMITS = { setter: 4, player: 26, guest: 6 };
export const PRESENCE_KEYS = { setter: "setters", player: "players", guest: "guests" };

export function isGuestParticipant(person) {
  return person?.role === "guest" || person?.type === "guest";
}

export function getPresenceLimit(list, group) {
  const key = `${PRESENCE_KEYS[group]}Limit`;
  const configured = list?.[key];
  return Number.isInteger(configured) && configured >= 0 ? configured : PRESENCE_LIMITS[group];
}

export function getPresenceGroups(list = {}, frozen = list?.status === "in_progress") {
  const setters = (frozen ? list?.confirmedSetters : null) || list?.setters || [];
  const players = (frozen ? list?.confirmedPlayers : null) || list?.players || [];
  const guests = (frozen ? list?.confirmedGuests : null) || list?.guests || [];
  const allGuests = [
    ...guests,
    ...setters.filter(isGuestParticipant).map((person) => ({ ...person, isSetter: true })),
    ...players.filter(isGuestParticipant),
  ];
  const uniqueGuests = new Map();
  for (const person of allGuests) {
    const previous = uniqueGuests.get(person.id);
    uniqueGuests.set(person.id, previous
      ? { ...previous, ...person, isSetter: Boolean(previous.isSetter || person.isSetter) }
      : person);
  }
  return {
    setters: setters.filter((person) => !isGuestParticipant(person)),
    players: players.filter((person) => !isGuestParticipant(person)),
    guests: [...uniqueGuests.values()],
  };
}

export function presenceUpdate(list, groups) {
  return {
    ...groups,
    ...(list.status === "in_progress" ? {
      confirmedSetters: groups.setters,
      confirmedPlayers: groups.players,
      confirmedGuests: groups.guests,
    } : {}),
  };
}

export function getGuestRequests(list) {
  const confirmed = new Set(Object.values(getPresenceGroups(list)).flat().map((person) => person.id));
  return (list?.guestRequests || []).filter((person) => !confirmed.has(person.id));
}
