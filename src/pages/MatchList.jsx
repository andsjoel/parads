/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  Crown,
  Star,
  Users,
  Venus,
  Volleyball,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import OrbitLoader from "../components/OrbitLoader";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import waitingListBackground from "../assets/app-backgrounds/bg-waiting-list.png";
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

function formatDate(date) {
  if (!date) return "Data nao definida";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

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

function LivePlayer({ player, profileBundle, onOpen }) {
  return (
    <button
      type="button"
      onClick={player.userId ? onOpen : undefined}
      className="match-player-row flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-[#fffaf0]">
          {profileBundle?.user?.profile?.displayName ||
            profileBundle?.user?.fullName ||
            player.displayName}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {player.kind === "ghost" && (
            <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-black text-[#9aa89f]">
              Ghost
            </span>
          )}
          {player.isSetter && (
            <span className="rounded-full bg-app-primary/15 px-2 py-0.5 text-[10px] font-black text-app-primary">
              Lev.
            </span>
          )}
          {player.sex === "female" && (
            <span className="rounded-full bg-app-accent/15 px-2 py-0.5 text-[10px] font-black text-app-accent">
              Mulher
            </span>
          )}
        </div>
      </div>

      {player.stats?.wins > 0 && (
        <span className="rounded-full bg-app-primary/15 px-2.5 py-1 text-xs font-black text-app-primary">
          {player.stats.wins}V
        </span>
      )}
    </button>
  );
}

function LiveTeam({ title, team, playersByEntryId, profilesById, onOpenProfile }) {
  const players = team?.players || [];

  return (
    <section className="match-panel p-4">
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

export default function MatchList() {
  const { userData, sessionData, isAdmin, isMember } = useAuth();

  const [list, setList] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [profilesById, setProfilesById] = useState({});
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

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

      if (!ids.length) {
        setProfilesById({});
        return;
      }

      try {
        const loadedProfiles = await getPublicProfileBundles(ids);

        if (userData?.id && ids.includes(userData.id)) {
          loadedProfiles[userData.id] = {
            user: userData,
            inventory: sessionData?.inventory || null,
            stats: sessionData?.stats || null,
          };
        }

        setProfilesById(loadedProfiles);
      } catch (error) {
        console.error(error);
      }
    }

    loadProfiles();
  }, [list, sessionData?.inventory, sessionData?.stats, userData]);

  const isListOpen = list?.status === "open";
  const isInProgress = list?.status === "in_progress";
  const setters = list?.setters || [];
  const players = list?.players || [];
  const totalConfirmed = setters.length + players.length;
  const totalLimit = (list?.settersLimit || 0) + (list?.playersLimit || 0);
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
      <main className="matches-page flex min-h-screen items-center justify-center px-5 pb-28 pt-6" style={{ backgroundImage: `url(${generalBackground})` }}>
        <OrbitLoader />
      </main>
    );
  }

  return (
    <main
      className={`matches-page min-h-screen px-5 pb-28 pt-6 text-white ${!list ? "matches-page--waiting" : ""}`}
      style={{ backgroundImage: `url(${list ? generalBackground : waitingListBackground})` }}
    >
      <section className="mx-auto w-full max-w-[420px] space-y-4">
        <header className="match-panel match-panel--header p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight text-[#fffaf0]">
                Lista do Volei
              </h1>
              <p className="match-header-old-meta mt-0.5 truncate text-xs font-semibold text-[#9aa89f]">
                {list
                  ? `${formatDate(list.date)} · ${
                      isInProgress
                        ? `${list.summary?.totalPlayers || 0} na quadra`
                        : `${totalConfirmed}/${totalLimit} confirmados`
                    }`
                  : "Aguardando abertura da lista"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {isAdmin && (
                <Link
                  to="/admin/volley-list"
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

          <div className="match-header-meta">
            <span>{list ? formatDate(list.date) : "Aguardando abertura"}</span>
            <span>
              {list
                ? isInProgress
                  ? `${list.summary?.totalPlayers || 0} na quadra`
                  : `${totalConfirmed}/${totalLimit}`
                : "-"}
            </span>
          </div>
        </header>

        {errorMessage && (
          <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {errorMessage}
          </p>
        )}

        {list && isListOpen && (
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

        {list && isInProgress && (
          <>
            <section className="match-panel p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/[0.04] p-2">
                  <p className="text-lg font-black text-[#fffaf0]">
                    {list.summary?.totalGames || 0}
                  </p>
                  <p className="text-[10px] font-bold text-[#9aa89f]">jogos</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-2">
                  <p className="text-lg font-black text-[#fffaf0]">
                    {list.summary?.totalPlayers || 0}
                  </p>
                  <p className="text-[10px] font-bold text-[#9aa89f]">
                    presentes
                  </p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] p-2">
                  <p className="text-lg font-black text-[#fffaf0]">
                    {list.summary?.totalWomen || 0}
                  </p>
                  <p className="text-[10px] font-bold text-[#9aa89f]">
                    <Venus size={10} className="inline" /> mulheres
                  </p>
                </div>
              </div>
            </section>

            {list.returnTeam && (
              <LiveTeam
                title="Volta"
                team={list.returnTeam}
                playersByEntryId={playersByEntryId}
                profilesById={profilesById}
                onOpenProfile={handleOpenProfile}
              />
            )}

            <section className="match-court-panel p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <Volleyball size={18} className="text-app-primary" />
                <h2 className="text-sm font-black text-[#fffaf0]">
                  Em quadra
                </h2>
              </div>

              <div className="space-y-3">
                {teams.slice(0, 2).map((team, index) => (
                  <LiveTeam
                    key={team.id}
                    title={`Time ${index + 1}`}
                    team={team}
                    playersByEntryId={playersByEntryId}
                    profilesById={profilesById}
                    onOpenProfile={handleOpenProfile}
                  />
                ))}
              </div>
            </section>

            {teams.slice(2).map((team, index) => (
              <LiveTeam
                key={team.id}
                title={`${index + 1}º Proxima`}
                team={team}
                playersByEntryId={playersByEntryId}
                profilesById={profilesById}
                onOpenProfile={handleOpenProfile}
              />
            ))}

            {!teams.length && (
              <section className="match-panel p-5 text-center">
                <Users className="mx-auto mb-2 text-app-primary" size={22} />
                <p className="text-sm font-black text-[#fffaf0]">
                  Aguardando o admin montar os times.
                </p>
              </section>
            )}
          </>
        )}
      </section>

      {!list && (
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
    </main>
  );
}
