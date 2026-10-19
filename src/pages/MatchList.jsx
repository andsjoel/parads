/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  Crown,
  Star,
  Users,
  Volleyball,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import OrbitLoader from "../components/OrbitLoader";
import CourtTeamsFrame from "../components/matches/CourtTeamsFrame";
import { buildTeamDisplaySlots } from "../utils/teamSlots";
import { getGuestRequests, getPresenceGroups, getPresenceLimit, isGuestParticipant, PRESENCE_KEYS } from "../utils/presenceGroups";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import waitingListBackground from "../assets/app-backgrounds/bg-waiting-list.png";
import waitingMatchBackground from "../assets/app-backgrounds/bg-waiting-match.png";
import {
  PlayerMiniCard,
  ProfileStickerModal,
} from "../components/profile/ProfileCardPreview";
import { usePublicProfilePreviews, useSelectedPublicProfile } from "../hooks/usePublicProfiles";
import {
  joinVolleyList,
  leaveVolleyList,
  requestVolleyListGuest,
  subscribeActiveVolleyList,
} from "../services/volleyListService";

function getErrorMessage(error) {
  if (error?.code === "permission-denied") {
    return "Nao foi possivel acessar a lista. Verifique as permissoes da colecao volley_lists no Firestore.";
  }

  return error?.message || "Nao foi possivel atualizar a lista.";
}

function PresenceGroup({
  title,
  icon: Icon,
  limit,
  people,
  emptyText,
  actionLabel,
  onAction,
  disabledAction,
  isBusy,
  profilesById,
  onOpenProfile,
  variant,
}) {
  return (
    <section className={`match-panel match-panel--${variant} p-4`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-app-primary/15 text-app-primary">
            <Icon size={18} />
          </div>

          <div>
            <h2 className="text-sm font-black text-[#fffaf0]">{title}</h2>
            <p className="text-xs text-[#9aa89f]">
              {limit === null ? people.length : `${people.length}/${Math.max(limit, people.length)}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAction}
          disabled={disabledAction || isBusy}
          className={`match-action px-3 py-2 text-xs font-black transition active:scale-[0.98] ${
            disabledAction || isBusy
              ? "cursor-not-allowed bg-white/[0.04] text-[#66736b]"
              : "match-action--active"
          }`}
        >
          {isBusy ? "..." : actionLabel}
        </button>
      </div>

      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-[#9aa89f]">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {people.map((person, index) => (
            <div key={person.id} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[10px] font-black text-app-primary">
                {index + 1}
              </span>

              <PlayerMiniCard
                person={person}
                profileBundle={profilesById[person.id]}
                onOpen={() => onOpenProfile(person)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FrozenPresenceModal({ list, profilesById, onOpenProfile, onClose }) {
  const presence = getPresenceGroups(list);
  const groups = [
    {
      title: "Levantadores",
      icon: Crown,
      people: presence.setters,
    },
    {
      title: "Jogadores",
      icon: Volleyball,
      people: presence.players,
    },
    { title: "Convidados", icon: Users, people: presence.guests },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-sm">
      <section className="profile-edit-modal flex max-h-[calc(100vh-3rem)] w-full max-w-[420px] flex-col p-5 text-white">
        <header className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <div>
            <h2 className="font-idv-title text-2xl">Lista de presenca</h2>
            <p className="mt-1 text-xs font-bold text-[#9aa89f]">Confirmacoes encerradas</p>
          </div>
          <button type="button" onClick={onClose} className="profile-modal-close flex h-9 w-9 items-center justify-center" aria-label="Fechar">
            <X size={17} />
          </button>
        </header>

        <div className="profile-edit-content min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {groups.map(({ title, icon: Icon, people }) => (
            <section key={title} className="match-panel p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={16} className="text-app-primary" />
                  <h3 className="text-sm font-black text-[#fffaf0]">{title}</h3>
                </div>
                <span className="text-xs font-black text-app-primary">{people.length}</span>
              </div>
              <div className="space-y-2">
                {people.map((person, index) => (
                  <div key={person.id} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[10px] font-black text-app-primary">{index + 1}</span>
                    <PlayerMiniCard person={person} profileBundle={profilesById[person.id]} onOpen={() => onOpenProfile(person)} />
                  </div>
                ))}
                {!people.length && <p className="py-3 text-center text-xs font-bold text-[#9aa89f]">Nenhum nome confirmado.</p>}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function LivePlayer({ player, profileBundle, onOpen, displayAsSetter = false }) {
  const effectiveSetter = player.isSetter || displayAsSetter;
  const identityClass = effectiveSetter && player.sex === "female"
    ? "admin-volley-player--setter-woman"
    : effectiveSetter
      ? "admin-volley-player--setter"
      : player.sex === "female"
        ? "admin-volley-player--woman"
        : "";

  return (
    <button
      type="button"
      onClick={player.userId ? onOpen : undefined}
      className={`match-player-row admin-volley-player ${identityClass} flex min-h-11 w-full items-center border px-3 py-2 text-left`}
    >
      <p className="min-w-0 flex-1 truncate text-sm font-black text-[#fffaf0]">
        {profileBundle?.user?.profile?.displayName || profileBundle?.user?.fullName || player.displayName}
      </p>
    </button>
  );
}

function ReturnCrownMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 128 92" className="match-return-crown">
      <path
        d="M17 30 C18 25 23 25 27 30 C34 38 40 43 45 44 C48 37 49 25 55 16 C58 11 63 12 66 18 C70 27 74 39 78 43 C84 40 92 32 101 25 C106 21 111 25 109 31 C106 45 103 60 99 72 C77 77 50 77 27 70 C24 58 20 43 17 30 Z M28 62 C47 68 77 69 100 63"
        fill="none"
        stroke="#f7bd37"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LiveTeam({ title, team, tone = "orange", womenRuleMode, playersByEntryId, profilesById, onOpenProfile, featured = false }) {
  const slots = buildTeamDisplaySlots({ team, playersByEntryId, womenRuleMode });

  const panel = (
    <section className={`match-panel volley-team-frame volley-team-frame--${tone} ${featured ? "match-return-team" : ""} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-[#fffaf0]">{title}</h2>
          {!featured && team?.wins > 0 && (
            <p className="text-xs font-semibold text-[#9aa89f]">{team.wins} vitorias</p>
          )}
        </div>
        <Volleyball size={18} className="text-app-primary" />
      </div>

      <div className="space-y-2">
        {slots.map((slot, index) => {
          const player = slot.player;

          if (!player) {
            return (
              <div
                key={`${team?.id}-${index}`}
                className={`admin-volley-slot admin-volley-slot--${slot.type} flex h-11 items-center justify-center rounded-2xl border border-dashed bg-white/[0.025] text-xs font-black`}
              >
                {slot.label}
              </div>
            );
          }

          return (
            <LivePlayer
              key={player.entryId}
              player={player}
              displayAsSetter={slot.displayAsSetter}
              profileBundle={profilesById[player.userId]}
              onOpen={() => onOpenProfile(player)}
            />
          );
        })}
      </div>
    </section>
  );

  if (!featured) return panel;

  return (
    <div className="match-return-wrap">
      <ReturnCrownMark />
      {panel}
    </div>
  );
}

function CourtTeamColumn({ title, team, tone, womenRuleMode, playersByEntryId, profilesById, onOpenProfile }) {
  const slots = buildTeamDisplaySlots({ team, playersByEntryId, womenRuleMode });

  return (
    <section className={`match-court-team-column match-court-team-column--${tone}`}>
      <header className="match-court-team-header flex items-center justify-between gap-2 px-3 py-3">
        <div>
          <h3 className="text-base font-black text-[#fffaf0]">{title}</h3>
        </div>
        <Volleyball size={18} />
      </header>

      <div className="space-y-1.5 px-2 pb-2">
        {slots.map((slot, index) => {
          const player = slot.player;
          return player ? (
            <LivePlayer
              key={player.entryId}
              player={player}
              displayAsSetter={slot.displayAsSetter}
              profileBundle={profilesById[player.userId]}
              onOpen={() => onOpenProfile(player)}
            />
          ) : (
            <div key={`${team?.id}-${index}`} className={`match-court-empty match-court-empty--${slot.type} flex h-11 items-center justify-center px-2 text-center text-xs font-black`}>
              {slot.label}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ArrivalOrder({ players, profilesById, onOpenProfile }) {
  return (
    <section className="match-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-[#fffaf0]">Ordem de chegada</h2>
          <p className="text-xs font-semibold text-[#9aa89f]">{players.length} presentes</p>
        </div>
        <Users size={18} className="text-app-primary" />
      </div>

      {players.length ? (
        <div className="space-y-2">
          {players.map((player, index) => (
            <div key={player.entryId} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[10px] font-black text-app-primary">
                {index + 1}
              </span>
              <PlayerMiniCard
                person={{
                  id: player.userId || player.entryId,
                  name: player.displayName,
                  username: player.username,
                }}
                profileBundle={profilesById[player.userId]}
                onOpen={() => player.userId && onOpenProfile(player)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="py-5 text-center text-xs font-bold text-[#9aa89f]">
          Aguardando o primeiro jogador chegar.
        </p>
      )}
    </section>
  );
}

export default function MatchList({ mode = "matches" }) {
  const { userData, sessionData, isAdmin, isMember } = useAuth();
  const isPresenceMode = mode === "presence";

  const [list, setList] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showFrozenList, setShowFrozenList] = useState(false);
  const presence = useMemo(() => getPresenceGroups(list), [list]);
  const selfBundle = useMemo(() => userData?.id ? {
    user: userData, inventory: sessionData?.inventory, stats: sessionData?.stats,
  } : null, [userData, sessionData?.inventory, sessionData?.stats]);
  const profileIds = [
    ...((isPresenceMode || showFrozenList) ? Object.values(presence).flat().map((person) => person.id) : []),
    ...(list?.matchPlayers || []).filter((person) => !person.removedAt).map((person) => person.userId),
  ];
  const profilesById = usePublicProfilePreviews(profileIds, { selfBundle, embedded: list?.mockProfiles });
  const selectedProfile = useSelectedPublicProfile(selectedPerson?.id,
    selectedPerson?.id === userData?.id ? selfBundle : list?.mockProfiles?.[selectedPerson?.id]);

  useEffect(() => {
    setIsLoading(true);

    const unsubscribe = subscribeActiveVolleyList({
      onChange: (activeList) => {
        setList(activeList);
        setErrorMessage("");
        setIsLoading(false);
      },
      onError: (error) => {
        console.error(error);
        setList(null);
        setErrorMessage(getErrorMessage(error));
        setIsLoading(false);
      },
    });

    return unsubscribe;
  }, []);

  const isListOpen = list?.status === "open";
  const isInProgress = list?.status === "in_progress";
  const isWaitingForMatch = !isPresenceMode && !isInProgress;
  const teams = list?.teams || [];
  const playersByEntryId = useMemo(() => {
    return (list?.matchPlayers || []).reduce((result, player) => {
      if (player.removedAt) return result;
      return {
        ...result,
        [player.entryId]: player,
      };
    }, {});
  }, [list?.matchPlayers]);

  const userGroup = useMemo(() => {
    if (!list || !userData?.id) return null;
    for (const [group, key] of Object.entries(PRESENCE_KEYS)) {
      if (presence[key].some((person) => person.id === userData.id)) return group;
    }
    return null;
  }, [list, presence, userData?.id]);

  const canChangeList = isMember && isListOpen;
  const isGuest = isGuestParticipant(userData);
  const hasGuestRequest = getGuestRequests(list).some((person) => person.id === userData?.id);

  async function runListAction(actionName, action) {
    try {
      setErrorMessage("");
      setBusyAction(actionName);
      await action();
    } catch (error) {
      console.error(error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  function handleJoin(group) {
    if (!list || !userData || !canChangeList) return;
    runListAction(`join-${group}`, () =>
      joinVolleyList({
        listId: list.id,
        group,
        userData,
      }),
    );
  }

  function handleLeave() {
    if (!list || !userData || !canChangeList || !userGroup) return;
    runListAction("leave", () =>
      leaveVolleyList({
        listId: list.id,
        userId: userData.id,
      }),
    );
  }

  function handleOpenProfile(person) {
    const userId = person.userId || person.id;
    if (!userId) return;

    setSelectedPerson({
      id: userId,
      name: person.displayName || person.name,
      username: person.username,
    });
  }

  if (isLoading) {
    return (
      <main className="matches-page flex min-h-screen items-center justify-center px-5 pb-28 pt-6" style={{ "--matches-background": `url(${generalBackground})` }}>
        <OrbitLoader />
      </main>
    );
  }

  return (
    <main
      className={`matches-page min-h-screen px-5 pb-28 pt-6 text-white ${isPresenceMode ? "matches-page--presence" : "matches-page--matches"} ${isPresenceMode && !list ? "matches-page--waiting" : ""}`}
      style={{
        "--matches-background": `url(${
          isPresenceMode && !list
            ? waitingListBackground
            : isWaitingForMatch
              ? waitingMatchBackground
              : generalBackground
        })`,
      }}
    >
      <section className="mx-auto w-full max-w-[420px] space-y-4">
        <header className="match-panel match-panel--header p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight text-[#fffaf0]">
                {isPresenceMode ? "Lista do Volei" : "Partidas"}
              </h1>
            </div>

            {isAdmin && (
                <Link
                  to={isPresenceMode ? "/admin/volley-list" : "/admin/matches"}
                  aria-label={isPresenceMode ? "Gestão da lista" : "Gestão das partidas"}
                  className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-app-primary/20 bg-app-primary/10 px-3 text-app-primary transition active:scale-95"
                >
                  <Star size={18} />
                  <span className="text-xs font-black">ADM</span>
                </Link>
            )}
          </div>

        </header>

        {errorMessage && (
          <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {errorMessage}
          </p>
        )}

        {isPresenceMode && list && (isListOpen || isInProgress) && [
          { group: "setter", title: "Levantadores", icon: Crown, emptyText: "Nenhum levantador confirmou ainda." },
          { group: "player", title: "Jogadores", icon: Volleyball, emptyText: "Nenhum jogador confirmou ainda." },
          { group: "guest", title: "Convidados", icon: Users, emptyText: "Nenhum convidado foi adicionado." },
        ].map(({ group, title, icon, emptyText }) => {
          const people = presence[PRESENCE_KEYS[group]];
          const limit = getPresenceLimit(list, group);
          const isGuestGroup = group === "guest";
          return (
            <PresenceGroup
              key={group}
              title={title}
              icon={icon}
              limit={limit}
              people={people}
              emptyText={emptyText}
              actionLabel={isGuestGroup && userGroup === "guest" ? "Confirmado" : isGuestGroup && hasGuestRequest ? "Aguardando" : !isListOpen ? "fechada" : isGuestGroup ? isGuest ? "Solicitar" : "Somente ADM" : userGroup === group ? "Sair" : "Entrar"}
              disabledAction={isGuestGroup ? !isGuest || !isListOpen || hasGuestRequest || Boolean(userGroup) : !canChangeList || (userGroup !== group && people.length >= limit)}
              isBusy={busyAction === `join-${group}` || (isGuestGroup && busyAction === "request-guest") || (busyAction === "leave" && userGroup === group)}
              profilesById={profilesById}
              onOpenProfile={handleOpenProfile}
              variant={PRESENCE_KEYS[group]}
              onAction={() => isGuestGroup
                ? runListAction("request-guest", () => requestVolleyListGuest({ listId: list.id }))
                : userGroup === group ? handleLeave() : handleJoin(group)}
            />
          );
        })}

        {!isPresenceMode && list && isInProgress && (
          <>
            {!list.teamsFormedAt && (
              <ArrivalOrder
                players={(list.matchPlayers || []).filter((player) => !player.removedAt)}
                profilesById={profilesById}
                onOpenProfile={handleOpenProfile}
              />
            )}

            {list.teamsFormedAt && list.returnTeam && (
              <LiveTeam
                title="Volta"
                tone="pink"
                featured
                team={list.returnTeam}
                womenRuleMode={list.returnTeam.womenRuleMode || list.womenRuleMode}
                playersByEntryId={playersByEntryId}
                profilesById={profilesById}
                onOpenProfile={handleOpenProfile}
              />
            )}

            {list.teamsFormedAt && <section className="match-court-combined">
              <CourtTeamsFrame>
                <CourtTeamColumn title="Time 1" team={teams[0]} tone="orange" womenRuleMode={teams[0].womenRuleMode || list.womenRuleMode} playersByEntryId={playersByEntryId} profilesById={profilesById} onOpenProfile={handleOpenProfile} />
                <CourtTeamColumn title="Time 2" team={teams[1]} tone="cyan" womenRuleMode={teams[1].womenRuleMode || list.womenRuleMode} playersByEntryId={playersByEntryId} profilesById={profilesById} onOpenProfile={handleOpenProfile} />
              </CourtTeamsFrame>
            </section>}

            {list.teamsFormedAt && teams.slice(2).map((team, index) => (
              <LiveTeam
                key={team.id}
                tone={index % 2 === 0 ? "green" : "pink"}
                title={`${index + 1}º Proxima`}
                team={team}
                womenRuleMode={team.womenRuleMode || list.womenRuleMode}
                playersByEntryId={playersByEntryId}
                profilesById={profilesById}
                onOpenProfile={handleOpenProfile}
              />
            ))}

          </>
        )}

        {!isPresenceMode && (!list || isListOpen) && (
          <h2 className="matches-waiting-match-message" aria-label="Aguardando a partida começar.">
            <span>Aguardando</span>
            <span>a partida</span>
            <span>começar.</span>
          </h2>
        )}
      </section>

      {isPresenceMode && !list && (
        <h2 className="matches-waiting-message" aria-label="A lista ainda não abriu.">
          <span>A lista</span>
          <span>ainda não</span>
          <span>abriu.</span>
        </h2>
      )}

      {selectedPerson && (
        <ProfileStickerModal
          fallbackPerson={selectedPerson}
          profileBundle={selectedProfile.bundle}
          isLoading={selectedProfile.loading}
          onClose={() => setSelectedPerson(null)}
        />
      )}

      {showFrozenList && list && (
        <FrozenPresenceModal
          list={list}
          profilesById={profilesById}
          onOpenProfile={handleOpenProfile}
          onClose={() => setShowFrozenList(false)}
        />
      )}
    </main>
  );
}
