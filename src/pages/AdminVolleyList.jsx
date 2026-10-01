/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarPlus,
  Crown,
  Pencil,
  Plus,
  RotateCcw,
  RotateCw,
  Shuffle,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  Users,
  Venus,
  Volleyball,
  X,
  XCircle,
} from "lucide-react";

import OrbitLoader from "../components/OrbitLoader";
import CourtTeamsFrame from "../components/matches/CourtTeamsFrame";
import { useAuth } from "../contexts/AuthContext";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import { buildTeamDisplaySlots } from "../utils/teamSlots";
import {
  addGhostPlayer,
  addVolleyMatchPlayer,
  adminAddVolleyListParticipant,
  adminRemoveVolleyListParticipant,
  createVolleyList,
  finishVolleyList,
  formInitialVolleyTeams,
  getVolleyAdminUsers,
  moveMatchPlayerToTeamVacancy,
  recordTeamWin,
  redoVolleyListAction,
  removeMatchPlayer,
  seedMockVolleyPlayers,
  startVolleyMatch,
  subscribeActiveVolleyList,
  swapMatchPlayers,
  swapVolleyListParticipants,
  toggleVolleyRule,
  undoVolleyListAction,
  updateMatchPlayerFlags,
} from "../services/volleyListService";

function formatDate(date) {
  if (!date) return "Data nao definida";

  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function maskDayMonth(value) {
  const numbers = value.replace(/\D/g, "").slice(0, 4);
  if (numbers.length <= 2) return numbers;
  return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
}

function resolveListDate(value) {
  const [day, month] = value.split("/").map(Number);
  const year = new Date().getFullYear();
  const parsed = new Date(year, month - 1, day);

  if (
    !day ||
    !month ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) return "";

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDisplayName(user) {
  return user.profile?.displayName || user.fullName || user.username || "Jogador";
}

function getErrorMessage(error) {
  if (error?.code === "permission-denied") return "Sem permissao para operar a lista.";
  return error?.message || "Nao foi possivel atualizar a lista.";
}

function PlayerPill({ player, placeholderLabel = "Vaga", placeholderType = "default", displayAsSetter = false, selected, onSelect, onEdit, onSelectVacancy }) {
  if (!player) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelectVacancy?.();
        }}
        disabled={!onSelectVacancy}
        className={`admin-volley-slot admin-volley-slot--${placeholderType} flex h-11 w-full items-center justify-center rounded-2xl border border-dashed bg-white/[0.025] text-xs font-black disabled:cursor-default`}
      >
        {placeholderLabel}
      </button>
    );
  }

  const effectiveSetter = player.isSetter || displayAsSetter;
  const identityClass = effectiveSetter && player.sex === "female"
    ? "admin-volley-player--setter-woman"
    : effectiveSetter
      ? "admin-volley-player--setter"
      : player.sex === "female"
        ? "admin-volley-player--woman"
        : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }
      }}
      className={`admin-volley-player ${identityClass} ${selected ? "admin-volley-player--selected" : ""} group flex min-h-11 w-full flex-1 items-center border px-3 py-2 text-left transition active:scale-[0.98] ${selected ? "border-app-primary bg-app-primary/15" : "border-white/10 bg-white/[0.045]"}`}
    >
      <p className="min-w-0 truncate text-sm font-black text-[#fffaf0]">{player.displayName}</p>
      {player.kind === "ghost" && (
        <span className="admin-guest-mark ml-2 shrink-0" title="Convidado" aria-label="Convidado">C</span>
      )}
      <span className="flex-1" />
      {selected && (
        <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-app-primary text-[#1a0504] active:scale-95" aria-label={`Editar ${player.displayName}`}>
          <Pencil size={15} />
        </button>
      )}
    </div>
  );
}

function TeamCard({
  title,
  team,
  tone = "orange",
  playersByEntryId,
  onWin,
  selectedEntryId,
  onSelectPlayer,
  canWin,
  womenRuleMode = "one",
  onSelectVacancy,
  combined = false,
}) {
  const slots = buildTeamDisplaySlots({ team, playersByEntryId, womenRuleMode });

  return (
    <section className={`admin-volley-card admin-volley-team volley-team-frame volley-team-frame--${tone} ${combined ? "admin-volley-team--combined" : ""} p-3`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-[#fffaf0]">{title}</h2>
          {!combined && team?.wins > 0 && (
            <p className="text-xs font-semibold text-[#9aa89f]">{team.wins}V</p>
          )}
        </div>

        {canWin && (
          <button
            type="button"
            onClick={onWin}
            className="admin-primary-action px-3 py-2 text-xs active:scale-[0.98]"
          >
            Venceu
          </button>
        )}
      </div>

      <div className="space-y-2">
        {slots.slice(0, 6).map((slot, index) => {
          const player = slot.player;

          return (
            <PlayerPill
              key={`${team?.id || title}-${index}`}
              player={player}
              placeholderLabel={slot.label}
              placeholderType={slot.type}
              displayAsSetter={slot.displayAsSetter}
              selected={selectedEntryId === player?.entryId}
              onSelect={() => onSelectPlayer(player)}
              onEdit={() => onSelectPlayer(player, true)}
              onSelectVacancy={selectedEntryId && typeof onSelectVacancy === "function"
                ? () => onSelectVacancy(team, slot.type)
                : null}
            />
          );
        })}
      </div>
    </section>
  );
}

function ResultSetterCard({ player, result }) {
  return (
    <div className={`admin-result-setter admin-result-setter--${result} flex h-12 items-center gap-3 border px-3`}>
      <Crown size={17} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm font-black text-[#fffaf0]">
        {player?.displayName || "Sem levantador"}
      </span>
    </div>
  );
}

function CurrentListModal({
  list,
  usersById,
  onClose,
  embedded = false,
  selectedUserId,
  onSelect,
  onRemove,
}) {
  const frozenSetters = list.confirmedSetters || list.setters || [];
  const frozenPlayers = list.confirmedPlayers || list.players || [];
  const groups = [
    { title: "Levantadores", icon: Crown, people: frozenSetters, limit: 4 },
    { title: "Jogadores", icon: Volleyball, people: frozenPlayers, limit: 26 },
  ];

  return (
    <div className={embedded ? "space-y-4" : "fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-sm"}>
      <div className={embedded ? "space-y-4" : "profile-edit-modal flex max-h-[calc(100vh-3rem)] w-full max-w-[420px] flex-col p-5 text-white"}>
        {!embedded && <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          <div>
            <h2 className="font-idv-title text-2xl">Lista atual</h2>
            <p className="mt-1 text-sm font-bold text-app-primary">
              {formatDate(list.date)} · {frozenSetters.length + frozenPlayers.length}/30
            </p>
          </div>
          <button type="button" onClick={onClose} className="profile-modal-close flex h-9 w-9 items-center justify-center text-white/70" aria-label="Fechar lista">
            <XCircle size={17} />
          </button>
        </div>}

        <div className={embedded ? "space-y-4" : "profile-edit-content min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"}>
          {groups.map(({ title, icon: Icon, people, limit }) => (
            <section
              key={title}
              className={`match-panel p-3 ${title === "Levantadores" ? "match-panel--setters" : "match-panel--players"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={16} className="text-app-primary" />
                  <h3 className="text-sm font-black text-[#fffaf0]">{title}</h3>
                </div>
                <span className="text-xs font-black text-app-primary">{people.length}/{limit}</span>
              </div>

              <div className="divide-y divide-white/8 border border-white/10 bg-black/15">
                {Array.from({ length: limit }).map((_, index) => {
                  const person = people[index];
                  const realName = person ? usersById[person.id]?.fullName?.trim() : "";

                  const isSelected = person?.id === selectedUserId;

                  return person ? (
                    <button
                      type="button"
                      key={`${title}-${index}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(person);
                      }}
                      className={`flex min-h-9 w-full items-center gap-3 px-3 py-2 text-left transition ${isSelected ? "bg-app-primary/15 text-app-primary" : "text-[#fffaf0]"}`}
                    >
                      <span className="w-5 shrink-0 text-center text-[10px] font-black text-app-primary">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {realName || person.name || "Jogador"}
                      </span>
                      {isSelected && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemove(person);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.stopPropagation();
                              onRemove(person);
                            }
                          }}
                          className="flex h-7 w-7 shrink-0 items-center justify-center text-red-300"
                          aria-label={`Remover ${realName || person.name}`}
                        >
                          <XCircle size={16} />
                        </span>
                      )}
                    </button>
                  ) : (
                    <div key={`${title}-${index}`} className="flex min-h-9 items-center gap-3 px-3 py-2 text-white/20">
                      <span className="w-5 shrink-0 text-center text-[10px] font-black text-app-primary">{index + 1}</span>
                      <span className="truncate text-sm font-bold">Vaga</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListActionModal({ action, isLoading, onClose, onConfirm }) {
  const isStart = action === "start";
  const isFinishDay = action === "finish-day";
  const Icon = isStart ? Volleyball : XCircle;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 px-5 pb-5 backdrop-blur-sm">
      <div className="profile-edit-modal w-full max-w-[420px] p-5 text-white">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center ${isStart ? "admin-service-icon" : "admin-delete-icon"}`}>
              <Icon size={20} />
            </div>
            <div>
              <h2 className="font-idv-title text-2xl">
                {isStart ? "Iniciar partida?" : isFinishDay ? "Finalizar pelada?" : "Encerrar lista?"}
              </h2>
              <p className="mt-1 text-sm text-white/48">
                {isStart
                  ? "As confirmações serão congeladas e a presença na quadra começará vazia."
                  : isFinishDay
                    ? "Deseja encerrar a pelada de hoje? O relatorio do dia sera gerado."
                    : "A lista será finalizada e não poderá receber novas alterações."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isLoading} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center text-white/70 disabled:opacity-50">
            <XCircle size={17} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} disabled={isLoading} className="register-outline-action h-11 text-sm disabled:opacity-50">
            cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={isLoading} className={`${isStart ? "admin-primary-action" : "admin-delete-action"} flex h-11 items-center justify-center text-sm disabled:opacity-50`}>
            {isLoading ? "aguarde..." : isStart ? "iniciar" : isFinishDay ? "finalizar" : "encerrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminVolleyList({ mode = "list" }) {
  const { isAdmin, userData } = useAuth();
  const navigate = useNavigate();
  const isListManagement = mode === "list";
  const isMatchManagement = mode === "matches";

  const [list, setList] = useState(null);
  const [users, setUsers] = useState([]);
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [playerActionTargetId, setPlayerActionTargetId] = useState(null);
  const [armedDeletePlayerId, setArmedDeletePlayerId] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualUser, setManualUser] = useState(null);
  const [manualGroup, setManualGroup] = useState("player");
  const [selectedListPerson, setSelectedListPerson] = useState(null);
  const [swapListPair, setSwapListPair] = useState(null);
  const [showFormTeamsConfirm, setShowFormTeamsConfirm] = useState(false);
  const [selectedMatchPlayerId, setSelectedMatchPlayerId] = useState(null);
  const [swapMatchPair, setSwapMatchPair] = useState(null);
  const [vacancySwapTarget, setVacancySwapTarget] = useState(null);
  const [winConfirmationIndex, setWinConfirmationIndex] = useState(null);

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
    if (!isAdmin) return;

    getVolleyAdminUsers()
      .then(setUsers)
      .catch((error) => {
        console.error(error);
      });
  }, [isAdmin]);

  useEffect(() => {
    if (!armedDeletePlayerId) return undefined;
    const timeoutId = window.setTimeout(() => setArmedDeletePlayerId(null), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [armedDeletePlayerId]);

  const playersByEntryId = useMemo(() => {
    return (list?.matchPlayers || []).reduce((result, player) => {
      if (player.removedAt) return result;
      return {
        ...result,
        [player.entryId]: player,
      };
    }, {});
  }, [list?.matchPlayers]);
  const playerActionTarget = playerActionTargetId
    ? playersByEntryId[playerActionTargetId]
    : null;

  const activeMatchPlayers = useMemo(
    () => (list?.matchPlayers || []).filter((player) => !player.removedAt),
    [list?.matchPlayers],
  );

  const confirmedPeople = useMemo(
    () => [...(list?.setters || []), ...(list?.players || [])],
    [list?.players, list?.setters],
  );

  const confirmedIds = new Set(confirmedPeople.map((person) => person.id));
  const searchableUsers = useMemo(() => {
    const byId = new Map(users.map((user) => [user.id, user]));

    confirmedPeople.forEach((person) => {
      if (byId.has(person.id)) return;
      const mockUser = list?.mockProfiles?.[person.id]?.user;
      byId.set(person.id, mockUser || {
        id: person.id,
        fullName: person.name || person.username || "Jogador",
        username: person.username || "",
        role: person.role || "guest",
        sex: person.sex || "male",
        profile: { displayName: person.name || person.username || "Jogador" },
      });
    });

    return [...byId.values()];
  }, [confirmedPeople, list?.mockProfiles, users]);
  const cleanSearch = search.trim().toLowerCase();
  const availableUsers = searchableUsers
    .filter((user) => !activeMatchPlayers.some((player) => player.userId === user.id))
    .filter((user) => {
      if (!cleanSearch) return true;
      return `${user.fullName || ""} ${getDisplayName(user)} ${user.username || ""}`
        .toLowerCase()
        .includes(cleanSearch);
    })
    .sort((first, second) => {
      const firstConfirmed = confirmedIds.has(first.id) ? 0 : 1;
      const secondConfirmed = confirmedIds.has(second.id) ? 0 : 1;
      return firstConfirmed - secondConfirmed;
    })
    .slice(0, 8);
  const cleanManualSearch = manualSearch.trim().toLowerCase();
  const manualUsers = users
    .filter((user) => !confirmedIds.has(user.id))
    .filter((user) => `${user.fullName || ""} ${getDisplayName(user)} ${user.username || ""}`
      .toLowerCase()
      .includes(cleanManualSearch))
    .slice(0, 8);
  const teams = Array.isArray(list?.teams) ? list.teams : [];
  const returnTeam = list?.returnTeam || null;
  const isOpen = list?.status === "open";
  const isInProgress = list?.status === "in_progress";
  const totalConfirmed = (list?.setters || []).length + (list?.players || []).length;
  const totalPresent = activeMatchPlayers.length;
  const canRedo = (list?.redoHistory || []).length > 0;
  const usersById = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, user])),
    [users],
  );

  async function runAdminAction(actionName, action) {
    try {
      setErrorMessage("");
      setBusyAction(actionName);
      await action();
      return true;
    } catch (error) {
      console.error(error);
      setErrorMessage(getErrorMessage(error));
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function handleManualAdd() {
    if (!list || !manualUser) return;

    const added = await runAdminAction("manual-list-add", () =>
      adminAddVolleyListParticipant({
        listId: list.id,
        group: manualGroup,
        userData: manualUser,
      }),
    );

    if (added) {
      setShowManualAdd(false);
      setManualSearch("");
      setManualUser(null);
      setManualGroup("player");
    }
  }

  function handleSelectListPerson(person) {
    if (selectedListPerson?.id === person.id) {
      setSelectedListPerson(null);
      return;
    }

    if (selectedListPerson) {
      setSwapListPair({ first: selectedListPerson, second: person });
      return;
    }

    setSelectedListPerson(person);
  }

  async function handleRemoveListPerson(person) {
    if (!list) return;
    const removed = await runAdminAction("remove-list-person", () =>
      adminRemoveVolleyListParticipant({ listId: list.id, userId: person.id }),
    );
    if (removed) setSelectedListPerson(null);
  }

  async function handleConfirmListSwap() {
    if (!list || !swapListPair) return;
    const swapped = await runAdminAction("swap-list-people", () =>
      swapVolleyListParticipants({
        listId: list.id,
        firstUserId: swapListPair.first.id,
        secondUserId: swapListPair.second.id,
      }),
    );
    if (swapped) {
      setSwapListPair(null);
      setSelectedListPerson(null);
    }
  }

  async function handleFormTeams() {
    if (!list) return;
    const formed = await runAdminAction("form-teams", () =>
      formInitialVolleyTeams({ listId: list.id }),
    );
    if (formed) {
      setSearch("");
      setShowFormTeamsConfirm(false);
    }
  }

  function handleCreateList() {
    const resolvedDate = resolveListDate(date);
    if (!resolvedDate || !userData || !isAdmin) return;

    runAdminAction("create", async () => {
      await createVolleyList({
        date: resolvedDate,
        adminUser: userData,
      });
      setDate("");
    });
  }

  function handleAddUser(user, isSetter = false) {
    if (!list) return;

    runAdminAction(`add-${user.id}`, async () => {
      await addVolleyMatchPlayer({
        listId: list.id,
        userData: user,
        overrides: {
          isSetter,
          sex: user.sex || "male",
        },
      });
      setSearch("");
    });
  }

  async function handleAddGuest() {
    if (!list || !search.trim()) return;

    let addedPlayer = null;
    const added = await runAdminAction("guest", async () => {
      addedPlayer = await addGhostPlayer({
        listId: list.id,
        displayName: search,
      });
    });

    if (added && addedPlayer) {
      setSearch("");
      setSelectedMatchPlayerId(addedPlayer.entryId);
      setPlayerActionTargetId(addedPlayer.entryId);
    }
  }

  function handleSelectPlayer(player, openEditor = false) {
    if (!player) return;

    if (openEditor) {
      setArmedDeletePlayerId(null);
      setPlayerActionTargetId(player.entryId);
      return;
    }

    if (selectedMatchPlayerId === player.entryId) {
      setSelectedMatchPlayerId(null);
      return;
    }

    if (selectedMatchPlayerId) {
      const first = playersByEntryId[selectedMatchPlayerId];
      if (first) setSwapMatchPair({ first, second: player });
      return;
    }

    setSelectedMatchPlayerId(player.entryId);
  }

  function closePlayerActionModal() {
    setArmedDeletePlayerId(null);
    setPlayerActionTargetId(null);
    setSelectedMatchPlayerId(null);
  }

  function handleToggleSetter(player) {
    if (!list || !player) return;

    runAdminAction(`setter-${player.entryId}`, () =>
      updateMatchPlayerFlags({
        listId: list.id,
        entryId: player.entryId,
        isSetter: !player.isSetter,
      }),
    );
  }

  function handleToggleSex(player) {
    if (!list || !player) return;

    runAdminAction(`sex-${player.entryId}`, () =>
      updateMatchPlayerFlags({
        listId: list.id,
        entryId: player.entryId,
        sex: player.sex === "female" ? "male" : "female",
      }),
    );
  }

  async function handleRemoveActionPlayer(player) {
    if (!list || !player) return;
    const removed = await runAdminAction(`remove-${player.entryId}`, () =>
      removeMatchPlayer({
        listId: list.id,
        entryId: player.entryId,
      }),
    );
    if (removed) {
      closePlayerActionModal();
      setSelectedMatchPlayerId(null);
    }
  }

  async function handleConfirmMatchSwap() {
    if (!list || !swapMatchPair) return;
    const swapped = await runAdminAction("swap-match-players", () =>
      swapMatchPlayers({
        listId: list.id,
        firstEntryId: swapMatchPair.first.entryId,
        secondEntryId: swapMatchPair.second.entryId,
      }),
    );
    if (swapped) {
      setSwapMatchPair(null);
      setSelectedMatchPlayerId(null);
    }
  }

  function cancelMatchSwap() {
    setSwapMatchPair(null);
    setVacancySwapTarget(null);
    setSelectedMatchPlayerId(null);
  }

  function handleMoveToVacancy(team, slotType) {
    if (!list || !team?.id || !selectedMatchPlayerId) return;

    setVacancySwapTarget({
      teamId: team.id,
      slotType,
    });
  }

  async function handleConfirmVacancySwap() {
    if (!list || !vacancySwapTarget || !selectedMatchPlayerId) return;

    const moved = await runAdminAction("move-to-vacancy", () =>
      moveMatchPlayerToTeamVacancy({
        listId: list.id,
        entryId: selectedMatchPlayerId,
        targetTeamId: vacancySwapTarget.teamId,
        slotType: vacancySwapTarget.slotType,
      }),
    );

    if (moved) {
      setVacancySwapTarget(null);
      setSelectedMatchPlayerId(null);
    }
  }

  async function handleConfirmTeamWin() {
    if (!list || winConfirmationIndex === null) return;

    const recorded = await runAdminAction(`win-${winConfirmationIndex}`, () =>
      recordTeamWin({
        listId: list.id,
        winningTeamIndex: winConfirmationIndex,
      }),
    );

    if (recorded) setWinConfirmationIndex(null);
  }

  if (!isAdmin) {
    return (
      <main className="admin-volley-page min-h-screen px-5 pb-28 pt-6 text-white" style={{ backgroundImage: `url(${generalBackground})` }}>
        <section className="mx-auto flex min-h-[60vh] w-full max-w-[420px] items-center justify-center">
          <div className="admin-panel p-6 text-center">
            <ShieldCheck className="mx-auto mb-3 text-[#ff713f]" size={28} />
            <p className="text-lg font-black text-[#fffaf0]">
              Somente administradores.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main onClick={() => { setSelectedListPerson(null); setSelectedMatchPlayerId(null); }} className={`admin-volley-page ${isMatchManagement ? "admin-volley-page--matches" : ""} min-h-screen px-5 pb-28 pt-6 text-white`} style={{ backgroundImage: `url(${generalBackground})` }}>
      <section className={`mx-auto w-full max-w-[420px] ${isMatchManagement ? "flex flex-col gap-4" : "space-y-4"}`}>
        {isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <OrbitLoader />
          </div>
        ) : (
          <>
            {errorMessage && (
              <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
                {errorMessage}
              </p>
            )}

            {!list ? (isMatchManagement ? (
              <section className="admin-volley-card p-6 text-center">
                <Volleyball size={24} className="mx-auto mb-3 text-app-primary" />
                <p className="text-sm font-black text-[#fffaf0]">Aguardando uma lista ser aberta.</p>
              </section>
            ) : (
              <section className="admin-volley-card admin-volley-create p-4">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarPlus size={18} className="text-app-primary" />
                  <h2 className="text-sm font-black text-[#fffaf0]">
                    Abrir pelada
                  </h2>
                </div>

                <input
                  type="text"
                  value={date}
                  onChange={(event) => setDate(maskDayMonth(event.target.value))}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="dd/mm"
                  aria-label="Dia e mês da lista"
                  className="mb-3 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-[#fffaf0] outline-none focus:border-app-primary/40"
                />

                <button
                  type="button"
                  onClick={handleCreateList}
                  disabled={!resolveListDate(date) || busyAction === "create"}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-app-primary text-sm font-black text-[#17231f] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-[#66736b]"
                >
                  <CalendarPlus size={17} />
                  {busyAction === "create" ? "Abrindo..." : "Abrir pelada"}
                </button>
              </section>
            )
            ) : (
              <>
                <section className="admin-volley-card admin-volley-summary p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-app-primary">
                        {isOpen ? "Aberta" : "Em andamento"}
                      </p>
                      <h2 className="mt-1 text-lg font-black text-[#fffaf0]">
                        {formatDate(list.date)}
                      </h2>
                    </div>

                    <p className="text-2xl font-black text-app-primary">
                      {isOpen ? totalConfirmed : totalPresent}
                    </p>
                  </div>
                </section>

                {isMatchManagement && isOpen && (
                  <section className="admin-volley-card p-6 text-center">
                    <p className="text-sm font-black text-[#fffaf0]">Aguardando o inicio da partida.</p>
                    <p className="mt-1 text-xs font-semibold text-[#9aa89f]">Inicie pela gestao da lista.</p>
                  </section>
                )}

                {isListManagement && <div className={`grid gap-2 ${isOpen ? "grid-cols-2" : "grid-cols-1"}`}>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => setConfirmAction("start")}
                      disabled={busyAction === "start-match"}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-app-primary text-sm font-black text-[#17231f] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-[#66736b]"
                    >
                      <Volleyball size={16} />
                      {busyAction === "start-match" ? "..." : "Iniciar partida"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setConfirmAction("finish")}
                    disabled={busyAction === "finish"}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-500/10 text-sm font-black text-red-300 active:scale-[0.98] disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    {busyAction === "finish" ? "..." : "Encerrar"}
                  </button>
                </div>}

                {isListManagement && (
                  <button
                    type="button"
                    onClick={() => setShowManualAdd(true)}
                    className="admin-primary-action flex h-11 w-full items-center justify-center gap-2 text-sm"
                  >
                    <UserRoundPlus size={16} />
                    adicionar
                  </button>
                )}

                {isListManagement && isOpen && (
                  <button
                    type="button"
                    onClick={() =>
                      runAdminAction("seed-mock", () =>
                        seedMockVolleyPlayers({ listId: list.id }),
                      )
                    }
                    disabled={busyAction === "seed-mock"}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-app-primary/35 bg-app-primary/10 text-sm font-black text-app-primary active:scale-[0.98] disabled:opacity-50"
                  >
                    <Users size={16} />
                    {busyAction === "seed-mock"
                      ? "Gerando teste..."
                      : "Popular teste: 30 jogadores"}
                  </button>
                )}

                {isListManagement && (
                  <CurrentListModal
                    list={list}
                    usersById={usersById}
                    embedded
                    selectedUserId={selectedListPerson?.id}
                    onSelect={handleSelectListPerson}
                    onRemove={handleRemoveListPerson}
                  />
                )}

                {isMatchManagement && isInProgress && (teams.length > 0 || (list.history || []).length > 0 || canRedo) && (
                  <section className="admin-volley-card admin-volley-rules p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRules((current) => !current)}
                        className="flex h-10 min-w-0 flex-1 items-center justify-between rounded-2xl bg-white/[0.04] px-3 text-sm font-black text-[#fffaf0] active:scale-[0.98]"
                      >
                        <span>Regras</span>
                        <span className="text-app-primary">
                          {showRules ? "▲" : "▼"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => runAdminAction(canRedo ? "redo" : "undo", () =>
                          canRedo
                            ? redoVolleyListAction({ listId: list.id })
                            : undoVolleyListAction({ listId: list.id }),
                        )}
                        disabled={canRedo ? busyAction === "redo" : busyAction === "undo"}
                        className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-[#fffaf0] active:scale-[0.98] disabled:opacity-50"
                      >
                        {canRedo ? <RotateCw size={13} /> : <RotateCcw size={13} />}
                        {canRedo ? "Refazer" : "Desfazer"}
                      </button>
                    </div>

                    {showRules && (
                      <div className="mt-2 space-y-2">
                        <div className="admin-rule-toggle admin-rule-toggle--women" aria-label="Regra de mulheres nos novos times">
                          {[
                            { value: "one", content: "1", label: "Uma mulher por time" },
                            { value: "random", content: <Shuffle key="random-icon" size={16} />, label: "Uma garantida e outra aleatoria" },
                            { value: "two", content: "2", label: "Duas mulheres por time" },
                          ].map(({ value, content, label }) => (
                            <button
                              key={value}
                              type="button"
                              aria-label={label}
                              title={label}
                              onClick={() => runAdminAction("women-rule", () =>
                                toggleVolleyRule({ listId: list.id, rule: "womenRuleMode", value }),
                              )}
                              className={list.womenRuleMode === value ? "is-active is-women" : ""}
                            >
                              {content}
                            </button>
                          ))}
                        </div>

                        <div className="admin-rule-toggle" aria-label="Regra de duas vitorias">
                          {[[false, "Nao sai"], [true, "Sai 2"]].map(([value, label]) => (
                            <button
                              key={String(value)}
                              type="button"
                              onClick={() => runAdminAction("exit-rule", () =>
                                toggleVolleyRule({ listId: list.id, rule: "exitAfterTwoWins", value }),
                              )}
                              className={list.exitAfterTwoWins === value ? "is-active" : ""}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {isMatchManagement && isInProgress && teams.length > 0 && (
                  <>
                    {returnTeam && (
                      <TeamCard
                        title="Volta"
                        tone="pink"
                        team={returnTeam}
                        playersByEntryId={playersByEntryId}
                        selectedEntryId={selectedMatchPlayerId}
                        onSelectPlayer={handleSelectPlayer}
                        womenRuleMode={returnTeam.womenRuleMode || list.womenRuleMode}
                        onSelectVacancy={handleMoveToVacancy}
                      />
                    )}

                    <CourtTeamsFrame className="admin-volley-teams-grid admin-match-court-teams">
                      {teams.slice(0, 2).map((team, index) => (
                        <TeamCard
                          key={team.id}
                          tone={index === 0 ? "orange" : "cyan"}
                          title={`Time ${index + 1}`}
                          team={team}
                          canWin={teams.length > 1}
                          onWin={() => setWinConfirmationIndex(index)}
                          playersByEntryId={playersByEntryId}
                          selectedEntryId={selectedMatchPlayerId}
                          onSelectPlayer={handleSelectPlayer}
                          womenRuleMode={team.womenRuleMode || list.womenRuleMode}
                          onSelectVacancy={handleMoveToVacancy}
                          combined
                        />
                      ))}
                    </CourtTeamsFrame>

                    {teams.slice(2).map((team, index) => (
                      <TeamCard
                        key={team.id}
                        tone={index % 2 === 0 ? "green" : "pink"}
                        title={`${index + 1}º Proxima`}
                        team={team}
                        playersByEntryId={playersByEntryId}
                        selectedEntryId={selectedMatchPlayerId}
                        onSelectPlayer={handleSelectPlayer}
                        womenRuleMode={team.womenRuleMode || list.womenRuleMode}
                        onSelectVacancy={handleMoveToVacancy}
                      />
                    ))}
                  </>
                )}

                {isMatchManagement && isInProgress && (
                  <>
                    <section className="admin-volley-card admin-volley-arrivals p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <UserRoundPlus size={17} className="text-app-primary" />
                        <h2 className="text-sm font-black text-[#fffaf0]">
                          Adicionar
                        </h2>
                      </div>

                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Digite o nome do jogador"
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-[#66736b] focus:border-app-primary/40"
                      />

                      {cleanSearch && (
                        <div className="admin-arrival-search-results mt-2 max-h-48 space-y-1 overflow-y-auto p-1">
                          {availableUsers.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => handleAddUser(
                                user,
                                (list.setters || []).some((item) => item.id === user.id),
                              )}
                              className="flex h-10 w-full items-center justify-between px-3 text-sm font-black text-[#fffaf0] active:scale-[0.98]"
                            >
                              <span className="truncate">{user.fullName || getDisplayName(user)}</span>
                              <span className="flex items-center gap-2">
                                {confirmedIds.has(user.id) && <small className="text-[9px] text-app-primary">confirmado</small>}
                                <Plus size={15} className="text-app-primary" />
                              </span>
                            </button>
                          ))}
                          {!availableUsers.length && (
                            <button
                              type="button"
                              onClick={handleAddGuest}
                              disabled={busyAction === "guest"}
                              className="admin-add-guest flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-black disabled:opacity-50"
                            >
                              <span className="min-w-0">
                                <small className="block text-[10px] text-[#9aa89f]">Nenhum jogador encontrado</small>
                                <span className="block truncate text-[#fffaf0]">adicionar como convidado</span>
                              </span>
                              <UserRoundPlus size={17} className="shrink-0 text-app-primary" />
                            </button>
                          )}
                        </div>
                      )}

                      {!list.teamsFormedAt && <div className="mt-3 space-y-2">
                        {activeMatchPlayers.map((player, index) => (
                          <div key={player.entryId} className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-xs font-black text-app-primary">{index + 1}</span>
                            <PlayerPill
                              player={player}
                              selected={selectedMatchPlayerId === player.entryId}
                              onSelect={() => handleSelectPlayer(player)}
                              onEdit={() => handleSelectPlayer(player, true)}
                            />
                          </div>
                        ))}
                        {!activeMatchPlayers.length && (
                          <p className="py-4 text-center text-xs font-bold text-[#9aa89f]">Aguardando o primeiro jogador chegar.</p>
                        )}
                      </div>}

                      {!list.teamsFormedAt && (
                        <button
                          type="button"
                          disabled={activeMatchPlayers.length < 12 || busyAction === "form-teams"}
                          onClick={() => setShowFormTeamsConfirm(true)}
                          className="admin-primary-action mt-3 flex h-11 w-full items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Users size={16} />
                          {activeMatchPlayers.length < 12
                            ? `formar times (${activeMatchPlayers.length}/12)`
                            : "formar times"}
                        </button>
                      )}
                    </section>

                    <button
                      type="button"
                      onClick={() => setConfirmAction("finish-day")}
                      disabled={busyAction === "finish"}
                      className="admin-finish-day flex h-12 w-full items-center justify-center gap-2 text-sm font-black text-red-200 disabled:opacity-50"
                    >
                      <XCircle size={17} />
                      {busyAction === "finish" ? "finalizando..." : "Finalizar Pelada"}
                    </button>

                  </>
                )}
              </>
            )}
          </>
        )}
      </section>

      {playerActionTarget && (
        <div onClick={closePlayerActionModal} className="fixed inset-0 z-[92] flex flex-col items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-[340px]">
            {armedDeletePlayerId === playerActionTarget.entryId && (
              <p className="player-delete-warning pointer-events-none absolute bottom-[calc(100%+14px)] left-0 w-full text-center text-sm font-black text-red-200">
                clique de novo para confirmar
              </p>
            )}
            <div onClick={(event) => event.stopPropagation()} className="profile-edit-modal w-full p-5 text-white">
            <header className="mb-5 flex items-center justify-between gap-3">
              <h2 className="min-w-0 truncate font-idv-title text-2xl">{playerActionTarget.displayName}</h2>
              <button type="button" onClick={closePlayerActionModal} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Fechar">
                <XCircle size={17} />
              </button>
            </header>

            <div className="grid grid-cols-3 gap-3">
              <button type="button" onClick={() => handleToggleSetter(playerActionTarget)} disabled={busyAction === `setter-${playerActionTarget.entryId}`} className={`flex h-14 items-center justify-center rounded-md border transition active:scale-95 ${playerActionTarget.isSetter ? "border-app-primary bg-app-primary text-[#17231f]" : "border-white/10 bg-white/[0.05] text-[#9aa89f]"}`} aria-label="Alternar levantador">
                <Crown size={21} />
              </button>
              <button type="button" onClick={() => handleToggleSex(playerActionTarget)} disabled={busyAction === `sex-${playerActionTarget.entryId}`} className={`flex h-14 items-center justify-center rounded-md border transition active:scale-95 ${playerActionTarget.sex === "female" ? "border-app-accent bg-app-accent text-white" : "border-white/10 bg-white/[0.05] text-[#9aa89f]"}`} aria-label="Alternar sexo">
                <Venus size={21} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (armedDeletePlayerId === playerActionTarget.entryId) {
                    handleRemoveActionPlayer(playerActionTarget);
                  } else {
                    setArmedDeletePlayerId(playerActionTarget.entryId);
                  }
                }}
                disabled={busyAction === `remove-${playerActionTarget.entryId}`}
                className={`flex h-14 items-center justify-center rounded-md border text-red-300 transition active:scale-95 ${armedDeletePlayerId === playerActionTarget.entryId ? "border-red-300/55 bg-red-500/25 shadow-[0_0_18px_rgba(248,113,113,0.18)]" : "border-red-300/20 bg-red-500/10"}`}
                aria-label="Excluir jogador"
              >
                <Trash2 size={21} />
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <ListActionModal
          action={confirmAction}
          isLoading={busyAction === "start-match" || busyAction === "finish"}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            if (confirmAction === "start") {
              await runAdminAction("start-match", () => startVolleyMatch({ listId: list.id }));
            } else {
              const finished = await runAdminAction("finish", () => finishVolleyList({ listId: list.id }));
              if (!finished) return;
              if (confirmAction === "finish-day") navigate("/admin/reports");
            }
            setConfirmAction(null);
          }}
        />
      )}

      {showManualAdd && list && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-5 pb-5 backdrop-blur-sm">
          <div className="profile-edit-modal flex max-h-[calc(100vh-2.5rem)] w-full max-w-[420px] flex-col p-5 text-white">
            <header className="mb-4 flex shrink-0 items-start justify-between gap-4">
              <div>
                <h2 className="font-idv-title text-2xl">Adicionar atleta</h2>
                <p className="mt-1 text-xs font-semibold text-[#9aa89f]">Inclua manualmente na lista de presenca.</p>
              </div>
              <button type="button" onClick={() => setShowManualAdd(false)} disabled={busyAction === "manual-list-add"} className="profile-modal-close flex h-9 w-9 items-center justify-center" aria-label="Fechar">
                <XCircle size={17} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <input
                value={manualSearch}
                onChange={(event) => {
                  setManualSearch(event.target.value);
                  setManualUser(null);
                }}
                placeholder="Digite o nome do usuario"
                autoFocus
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-[#66736b] focus:border-app-primary/40"
              />

              <div className="admin-arrival-search-results mt-2 max-h-48 space-y-1 overflow-y-auto p-1">
                {manualUsers.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      setManualUser(candidate);
                      setManualSearch(candidate.fullName || getDisplayName(candidate));
                    }}
                    className={`flex h-10 w-full items-center justify-between px-3 text-left text-sm font-black active:scale-[0.98] ${manualUser?.id === candidate.id ? "bg-app-primary/15 text-app-primary" : "text-[#fffaf0]"}`}
                  >
                    <span className="truncate">{candidate.fullName || getDisplayName(candidate)}</span>
                    <Plus size={15} />
                  </button>
                ))}
                {!manualUsers.length && <p className="px-3 py-3 text-center text-xs font-bold text-[#9aa89f]">Nenhum usuario disponivel.</p>}
              </div>

              <div className="relative mt-4 grid h-11 grid-cols-2 overflow-hidden rounded-md border border-white/10 bg-black/25 p-1" role="group" aria-label="Posicao na lista">
                <span
                  className={`pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-[3px] bg-gradient-to-r from-[#ff3d2e] to-[#ff8a2e] shadow-[0_0_16px_rgba(255,80,42,0.24)] transition-transform duration-200 ${manualGroup === "player" ? "translate-x-full" : "translate-x-0"}`}
                />
                <button type="button" onClick={() => setManualGroup("setter")} aria-pressed={manualGroup === "setter"} className={`relative z-10 flex items-center justify-center gap-1.5 text-xs font-black transition-colors ${manualGroup === "setter" ? "text-[#1a0504]" : "text-[#9aa89f]"}`}>
                  <Crown size={14} />
                  levantador
                </button>
                <button type="button" onClick={() => setManualGroup("player")} aria-pressed={manualGroup === "player"} className={`relative z-10 flex items-center justify-center gap-1.5 text-xs font-black transition-colors ${manualGroup === "player" ? "text-[#1a0504]" : "text-[#9aa89f]"}`}>
                  <Volleyball size={14} />
                  jogador
                </button>
              </div>
            </div>

            <div className="mt-4 grid shrink-0 grid-cols-2 gap-2">
              <button type="button" onClick={() => setShowManualAdd(false)} disabled={busyAction === "manual-list-add"} className="register-outline-action h-11 text-sm">cancelar</button>
              <button type="button" onClick={handleManualAdd} disabled={!manualUser || busyAction === "manual-list-add"} className="admin-primary-action flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-40">
                <UserRoundPlus size={16} />
                {busyAction === "manual-list-add" ? "adicionando..." : "adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {swapListPair && (
        <div onClick={(event) => event.stopPropagation()} className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 px-5 pb-5 backdrop-blur-sm">
          <div className="profile-edit-modal w-full max-w-[420px] p-5 text-white">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-idv-title text-2xl">Trocar posicoes?</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#9aa89f]">
                  Deseja trocar {usersById[swapListPair.first.id]?.fullName || swapListPair.first.name} com {usersById[swapListPair.second.id]?.fullName || swapListPair.second.name}?
                </p>
              </div>
              <button type="button" onClick={() => setSwapListPair(null)} disabled={busyAction === "swap-list-people"} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Fechar">
                <XCircle size={17} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSwapListPair(null)} disabled={busyAction === "swap-list-people"} className="register-outline-action h-11 text-sm">cancelar</button>
              <button type="button" onClick={handleConfirmListSwap} disabled={busyAction === "swap-list-people"} className="admin-primary-action flex h-11 items-center justify-center text-sm disabled:opacity-50">
                {busyAction === "swap-list-people" ? "trocando..." : "trocar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {swapMatchPair && (
        <div onClick={(event) => event.stopPropagation()} className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 px-5 pb-5 backdrop-blur-sm">
          <div className="profile-edit-modal w-full max-w-[420px] p-5 text-white">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-idv-title text-2xl">Trocar jogadores?</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#9aa89f]">
                  Deseja trocar {swapMatchPair.first.displayName} com {swapMatchPair.second.displayName}?
                </p>
              </div>
              <button type="button" onClick={cancelMatchSwap} disabled={busyAction === "swap-match-players"} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Fechar">
                <XCircle size={17} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={cancelMatchSwap} disabled={busyAction === "swap-match-players"} className="register-outline-action h-11 text-sm">cancelar</button>
              <button type="button" onClick={handleConfirmMatchSwap} disabled={busyAction === "swap-match-players"} className="admin-primary-action flex h-11 items-center justify-center text-sm disabled:opacity-50">
                {busyAction === "swap-match-players" ? "trocando..." : "trocar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {vacancySwapTarget && selectedMatchPlayerId && (
        <div onClick={(event) => event.stopPropagation()} className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 px-5 pb-5 backdrop-blur-sm">
          <div className="profile-edit-modal w-full max-w-[420px] p-5 text-white">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-idv-title text-2xl">Trocar posicao?</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#9aa89f]">
                  Deseja trocar {playersByEntryId[selectedMatchPlayerId]?.displayName || "jogador"} com {vacancySwapTarget.slotType === "setter" ? "vaga de levantador" : vacancySwapTarget.slotType === "woman" ? "vaga feminina" : "vaga vazia"}?
                </p>
              </div>
              <button type="button" onClick={cancelMatchSwap} disabled={busyAction === "move-to-vacancy"} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Fechar">
                <XCircle size={17} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={cancelMatchSwap} disabled={busyAction === "move-to-vacancy"} className="register-outline-action h-11 text-sm">cancelar</button>
              <button type="button" onClick={handleConfirmVacancySwap} disabled={busyAction === "move-to-vacancy"} className="admin-primary-action flex h-11 items-center justify-center text-sm disabled:opacity-50">
                {busyAction === "move-to-vacancy" ? "trocando..." : "trocar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFormTeamsConfirm && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 px-5 pb-5 backdrop-blur-sm">
          <div className="profile-edit-modal w-full max-w-[420px] p-5 text-white">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-idv-title text-2xl">Sortear times?</h2>
                <p className="mt-2 text-sm text-[#9aa89f]">Deseja sortear os times?</p>
              </div>
              <button type="button" onClick={() => setShowFormTeamsConfirm(false)} disabled={busyAction === "form-teams"} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Fechar">
                <XCircle size={17} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setShowFormTeamsConfirm(false)} disabled={busyAction === "form-teams"} className="register-outline-action h-11 text-sm">cancelar</button>
              <button type="button" onClick={handleFormTeams} disabled={busyAction === "form-teams"} className="admin-primary-action flex h-11 items-center justify-center text-sm disabled:opacity-50">
                {busyAction === "form-teams" ? "sorteando..." : "sortear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {winConfirmationIndex !== null && teams[winConfirmationIndex] && teams[winConfirmationIndex === 0 ? 1 : 0] && (() => {
        const winnerTeam = teams[winConfirmationIndex];
        const loserTeam = teams[winConfirmationIndex === 0 ? 1 : 0];
        const findSetter = (team) => {
          const teamPlayers = (team.players || []).map((entryId) => playersByEntryId[entryId]).filter(Boolean);
          return teamPlayers.find((player) => player.isSetter)
            || teamPlayers.find((player) => player.entryId === team.temporarySetterEntryId)
            || null;
        };

        return (
          <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 px-5 pb-5 backdrop-blur-sm">
            <div className="profile-edit-modal admin-result-modal w-full max-w-[420px] p-5 text-white">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-idv-title text-2xl">Confirmar vencedor</h2>
                <button type="button" onClick={() => setWinConfirmationIndex(null)} disabled={busyAction.startsWith("win-")} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Fechar">
                  <XCircle size={17} />
                </button>
              </div>

              <p className="admin-result-label admin-result-label--winner mb-2 flex items-baseline gap-2 uppercase">
                <strong>Venceu</strong>
                <span>Time de:</span>
              </p>
              <ResultSetterCard player={findSetter(winnerTeam)} result="winner" />

              <div className="flex h-14 items-center justify-center">
                <span className="admin-result-versus inline-flex h-9 w-10 items-center justify-center bg-red-500 text-white">
                  <X size={20} strokeWidth={3.2} />
                </span>
              </div>

              <p className="admin-result-label admin-result-label--loser mb-2 flex items-baseline gap-2 uppercase">
                <strong>Perdeu</strong>
                <span>Time de:</span>
              </p>
              <ResultSetterCard player={findSetter(loserTeam)} result="loser" />

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setWinConfirmationIndex(null)} disabled={busyAction.startsWith("win-")} className="register-outline-action h-11 text-sm">cancelar</button>
                <button type="button" onClick={handleConfirmTeamWin} disabled={busyAction.startsWith("win-")} className="admin-primary-action flex h-11 items-center justify-center text-sm disabled:opacity-50">
                  {busyAction.startsWith("win-") ? "confirmando..." : "confirmar"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </main>
  );
}
