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
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import waitingListBackground from "../assets/app-backgrounds/bg-waiting-list.png";
import waitingMatchBackground from "../assets/app-backgrounds/bg-waiting-match.png";
import {
  PlayerMiniCard,
  ProfileStickerModal,
} from "../components/profile/ProfileCardPreview";
import { getPublicProfileBundles } from "../services/publicProfileService";
import {
  joinVolleyList,
  leaveVolleyList,
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
              {people.length}/{limit}
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
  const groups = [
    {
      title: "Levantadores",
      icon: Crown,
      people: list.confirmedSetters || list.setters || [],
    },
    {
      title: "Jogadores",
      icon: Volleyball,
      people: list.confirmedPlayers || list.players || [],
    },
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

function LivePlayer({ player, profileBundle, onOpen }) {
  const identityClass = player.isSetter && player.sex === "female"
    ? "admin-volley-player--setter-woman"
    : player.isSetter
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

function LiveTeam({ title, team, tone = "orange", playersByEntryId, profilesById, onOpenProfile }) {
  const players = team?.players || [];

  return (
    <section className={`match-panel volley-team-frame volley-team-frame--${tone} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-[#fffaf0]">{title}</h2>
          <p className="text-xs font-semibold text-[#9aa89f]">
            {players.length}/6 {team?.wins ? `· ${team.wins} vitorias` : ""}
          </p>
        </div>
        <Volleyball size={18} className="text-app-primary" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => {
          const player = playersByEntryId[players[index]];

          if (!player) {
            return (
              <div
                key={`${team?.id}-${index}`}
                className="flex h-11 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] text-xs font-black text-[#66736b]"
              >
                Vaga
              </div>
            );
          }

          return (
            <LivePlayer
              key={player.entryId}
              player={player}
              profileBundle={profilesById[player.userId]}
              onOpen={() => onOpenProfile(player)}
            />
          );
        })}
      </div>
    </section>
  );
}

function CourtTeamColumn({ title, team, tone, playersByEntryId, profilesById, onOpenProfile }) {
  const players = team?.players || [];

  return (
    <section className={`match-court-team-column match-court-team-column--${tone}`}>
      <header className="match-court-team-header flex items-center justify-between gap-2 px-3 py-3">
        <div>
          <h3 className="text-base font-black text-[#fffaf0]">{title}</h3>
          <p className="text-xs font-black text-[#9aa89f]">{players.length}/6</p>
        </div>
        <Volleyball size={18} />
      </header>

      <div className="space-y-1.5 px-2 pb-2">
        {Array.from({ length: 6 }).map((_, index) => {
          const player = playersByEntryId[players[index]];
          return player ? (
            <LivePlayer
              key={player.entryId}
              player={player}
              profileBundle={profilesById[player.userId]}
              onOpen={() => onOpenProfile(player)}
            />
          ) : (
            <div key={`${team?.id}-${index}`} className="match-court-empty flex h-11 items-center px-3 text-xs font-black text-[#66736b]">
              Vaga
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
  const [profilesById, setProfilesById] = useState({});
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showFrozenList, setShowFrozenList] = useState(false);

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

  useEffect(() => {
    async function loadProfiles() {
      const ids = [
        ...(list?.setters || []).map((person) => person.id),
        ...(list?.players || []).map((person) => person.id),
        ...(list?.matchPlayers || []).map((person) => person.userId),
      ].filter(Boolean);
      const mockProfiles = list?.mockProfiles || {};
      const remoteIds = [...new Set(ids)].filter((id) => !mockProfiles[id]);

      if (!ids.length) {
        setProfilesById(mockProfiles);
        return;
      }

      try {
        const loadedProfiles = remoteIds.length
          ? await getPublicProfileBundles(remoteIds)
          : {};
        const nextProfiles = { ...mockProfiles, ...loadedProfiles };

        if (userData?.id && ids.includes(userData.id)) {
          nextProfiles[userData.id] = {
            user: userData,
            inventory: sessionData?.inventory || null,
            stats: sessionData?.stats || null,
          };
        }

        setProfilesById(nextProfiles);
      } catch (error) {
        console.error(error);
      }
    }

    loadProfiles();
  }, [list, sessionData?.inventory, sessionData?.stats, userData]);

  const isListOpen = list?.status === "open";
  const isInProgress = list?.status === "in_progress";
  const isWaitingForMatch = !isPresenceMode && !isInProgress;
  const setters = list?.setters || [];
  const players = list?.players || [];
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
    if ((list.setters || []).some((person) => person.id === userData.id)) return "setter";
    if ((list.players || []).some((person) => person.id === userData.id)) return "player";
    return null;
  }, [list, userData?.id]);

  const canChangeList = isMember && isListOpen;

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

  async function handleOpenProfile(person) {
    const userId = person.userId || person.id;
    if (!userId) return;

    setSelectedPerson({
      id: userId,
      name: person.displayName || person.name,
      username: person.username,
    });

    if (profilesById[userId]) return;

    try {
      setIsLoadingProfile(true);
      const nextProfilesById = await getPublicProfileBundles([userId]);
      setProfilesById((current) => ({
        ...current,
        ...nextProfilesById,
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingProfile(false);
    }
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

            <div className="flex shrink-0 items-center gap-2">
              {isAdmin && (
                <Link
                  to={isPresenceMode ? "/admin/volley-list" : "/admin/matches"}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-app-primary/20 bg-app-primary/10 text-app-primary transition active:scale-95"
                >
                  <Star size={18} />
                </Link>
              )}

              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-app-primary/15 text-app-primary">
                <Volleyball size={20} />
              </div>
            </div>
          </div>

        </header>

        {errorMessage && (
          <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {errorMessage}
          </p>
        )}

        {isPresenceMode && list && isListOpen && (
          <>
            <PresenceGroup
              title="Levantadores"
              icon={Crown}
              limit={list.settersLimit}
              people={setters}
              emptyText="Nenhum levantador confirmou ainda."
              actionLabel={userGroup === "setter" ? "Sair" : "Entrar"}
              disabledAction={
                !canChangeList ||
                (userGroup !== "setter" && setters.length >= list.settersLimit)
              }
              isBusy={busyAction === "join-setter" || busyAction === "leave"}
              profilesById={profilesById}
              onOpenProfile={handleOpenProfile}
              variant="setters"
              onAction={() =>
                userGroup === "setter" ? handleLeave() : handleJoin("setter")
              }
            />

            <PresenceGroup
              title="Jogadores"
              icon={Volleyball}
              limit={list.playersLimit}
              people={players}
              emptyText="Nenhum jogador confirmou ainda."
              actionLabel={userGroup === "player" ? "Sair" : "Entrar"}
              disabledAction={
                !canChangeList ||
                (userGroup !== "player" && players.length >= list.playersLimit)
              }
              isBusy={busyAction === "join-player" || busyAction === "leave"}
              profilesById={profilesById}
              onOpenProfile={handleOpenProfile}
              variant="players"
              onAction={() =>
                userGroup === "player" ? handleLeave() : handleJoin("player")
              }
            />

          </>
        )}

        {isPresenceMode && list && isInProgress && (
          <>
            <PresenceGroup
              title="Levantadores"
              icon={Crown}
              limit={list.settersLimit}
              people={list.confirmedSetters || list.setters || []}
              emptyText="Nenhum levantador confirmou."
              actionLabel="fechada"
              disabledAction
              profilesById={profilesById}
              onOpenProfile={handleOpenProfile}
              variant="setters"
            />
            <PresenceGroup
              title="Jogadores"
              icon={Volleyball}
              limit={list.playersLimit}
              people={list.confirmedPlayers || list.players || []}
              emptyText="Nenhum jogador confirmou."
              actionLabel="fechada"
              disabledAction
              profilesById={profilesById}
              onOpenProfile={handleOpenProfile}
              variant="players"
            />
          </>
        )}

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
                team={list.returnTeam}
                playersByEntryId={playersByEntryId}
                profilesById={profilesById}
                onOpenProfile={handleOpenProfile}
              />
            )}

            {list.teamsFormedAt && <section className="match-court-combined">
              <div className="match-court-teams grid grid-cols-2">
                <CourtTeamColumn title="Time 1" team={teams[0]} tone="orange" playersByEntryId={playersByEntryId} profilesById={profilesById} onOpenProfile={handleOpenProfile} />
                <CourtTeamColumn title="Time 2" team={teams[1]} tone="cyan" playersByEntryId={playersByEntryId} profilesById={profilesById} onOpenProfile={handleOpenProfile} />
              </div>
            </section>}

            {list.teamsFormedAt && teams.slice(2).map((team, index) => (
              <LiveTeam
                key={team.id}
                tone={index % 2 === 0 ? "green" : "pink"}
                title={`${index + 1}º Proxima`}
                team={team}
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
          profileBundle={profilesById[selectedPerson.id]}
          isLoading={isLoadingProfile && !profilesById[selectedPerson.id]}
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
