/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Crown,
  Eye,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  Users,
  Venus,
  Volleyball,
  XCircle,
} from "lucide-react";

import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import OrbitLoader from "../components/OrbitLoader";
import { useAuth } from "../contexts/AuthContext";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import {
  addGhostPlayer,
  addVolleyMatchPlayer,
  createVolleyList,
  finishVolleyList,
  getVolleyAdminUsers,
  recordTeamWin,
  removeMatchPlayer,
  seedMockVolleyPlayers,
  startVolleyMatch,
  subscribeActiveVolleyList,
  swapMatchPlayers,
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

function PlayerPill({
  player,
  selected,
  onSelect,
  onRemove,
  onToggleSetter,
  onToggleSex,
}) {
  if (!player) {
    return (
      <div className="admin-volley-slot flex h-11 items-center justify-center text-xs font-black text-[#66736b]">
        Vaga
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`admin-volley-player group flex min-h-11 items-center justify-between gap-2 border px-3 py-2 text-left transition active:scale-[0.98] ${
        selected
          ? "border-app-primary bg-app-primary/14 shadow-[0_0_18px_rgba(255,183,3,0.18)]"
          : "border-white/10 bg-white/[0.045]"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-[#fffaf0]">
          {player.displayName}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-black text-[#9aa89f]">
            {player.kind === "ghost" ? "Ghost" : player.kind === "guest" ? "Guest" : "Membro"}
          </span>
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

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSetter();
          }}
          className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/10 ${
            player.isSetter ? "bg-app-primary text-[#17231f]" : "bg-white/[0.04] text-[#9aa89f]"
          }`}
        >
          <Crown size={13} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSex();
          }}
          className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/10 ${
            player.sex === "female" ? "bg-app-accent text-white" : "bg-white/[0.04] text-[#9aa89f]"
          }`}
        >
          <Venus size={13} />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-red-300/15 bg-red-500/10 text-red-300"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function TeamCard({
  title,
  team,
  playersByEntryId,
  onWin,
  selectedEntryId,
  onSelectPlayer,
  onRemovePlayer,
  onToggleSetter,
  onToggleSex,
  canWin,
}) {
  const players = team?.players || [];

  return (
    <section className="admin-volley-card admin-volley-team p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-[#fffaf0]">{title}</h2>
          <p className="text-xs font-semibold text-[#9aa89f]">
            {players.length}/6 jogadores {team?.wins ? `· ${team.wins}V` : ""}
          </p>
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
        {Array.from({ length: 6 }).map((_, index) => {
          const player = playersByEntryId[players[index]];

          return (
            <PlayerPill
              key={`${team?.id || title}-${index}`}
              player={player}
              selected={selectedEntryId === player?.entryId}
              onSelect={() => onSelectPlayer(player)}
              onRemove={() => onRemovePlayer(player)}
              onToggleSetter={() => onToggleSetter(player)}
              onToggleSex={() => onToggleSex(player)}
            />
          );
        })}
      </div>
    </section>
  );
}

function PresenceCard({ title, icon: Icon, people, limit }) {
  return (
    <section className="admin-volley-card admin-volley-presence p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-app-primary/15 text-app-primary">
            <Icon size={16} />
          </div>
          <h2 className="text-sm font-black text-[#fffaf0]">{title}</h2>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-black text-app-primary">
          {people.length}/{limit}
        </span>
      </div>

      {people.length ? (
        <div className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
          {people.map((person, index) => (
            <div
              key={person.id}
              className="flex min-h-11 items-center gap-3 px-3 py-2"
            >
              <span className="w-5 shrink-0 text-center text-[10px] font-black text-app-primary">
                {index + 1}
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#fffaf0]">
                  {person.name || person.username || "Jogador"}
                </p>
                {person.username && (
                  <p className="truncate text-[11px] font-semibold text-[#9aa89f]">
                    @{person.username}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-center text-xs font-semibold text-[#9aa89f]">
          Nenhum nome nessa lista.
        </p>
      )}
    </section>
  );
}

function CurrentListModal({ list, usersById, onClose }) {
  const groups = [
    { title: "Levantadores", icon: Crown, people: list.setters || [], limit: 4 },
    { title: "Jogadores", icon: Volleyball, people: list.players || [], limit: 26 },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-sm">
      <div className="profile-edit-modal flex max-h-[calc(100vh-3rem)] w-full max-w-[420px] flex-col p-5 text-white">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          <div>
            <h2 className="font-idv-title text-2xl">Lista atual</h2>
            <p className="mt-1 text-sm font-bold text-app-primary">
              {formatDate(list.date)} · {(list.setters || []).length + (list.players || []).length}/30
            </p>
          </div>
          <button type="button" onClick={onClose} className="profile-modal-close flex h-9 w-9 items-center justify-center text-white/70" aria-label="Fechar lista">
            <XCircle size={17} />
          </button>
        </div>

        <div className="profile-edit-content min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {groups.map(({ title, icon: Icon, people, limit }) => (
            <section key={title} className="admin-volley-card admin-volley-presence p-3">
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

                  return (
                    <div key={`${title}-${index}`} className="flex min-h-9 items-center gap-3 px-3 py-2">
                      <span className="w-5 shrink-0 text-center text-[10px] font-black text-app-primary">{index + 1}</span>
                      <span className={`truncate text-sm font-bold ${realName ? "text-[#fffaf0]" : "text-white/20"}`}>
                        {realName || "Vaga"}
                      </span>
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
                {isStart ? "Iniciar lista?" : "Encerrar lista?"}
              </h2>
              <p className="mt-1 text-sm text-white/48">
                {isStart
                  ? "Os times serão montados e a partida será iniciada."
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
            {isLoading ? "aguarde..." : isStart ? "iniciar" : "encerrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminVolleyList() {
  const { isAdmin, userData } = useAuth();

  const [list, setList] = useState(null);
  const [users, setUsers] = useState([]);
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [ghostName, setGhostName] = useState("");
  const [ghostSex, setGhostSex] = useState("male");
  const [ghostSetter, setGhostSetter] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showCurrentList, setShowCurrentList] = useState(false);

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

  const playersByEntryId = useMemo(() => {
    return (list?.matchPlayers || []).reduce((result, player) => {
      if (player.removedAt) return result;
      return {
        ...result,
        [player.entryId]: player,
      };
    }, {});
  }, [list?.matchPlayers]);

  const activeMatchPlayers = useMemo(
    () => (list?.matchPlayers || []).filter((player) => !player.removedAt),
    [list?.matchPlayers],
  );

  const confirmedPeople = useMemo(
    () => [...(list?.setters || []), ...(list?.players || [])],
    [list?.players, list?.setters],
  );

  const availableConfirmed = confirmedPeople.filter(
    (person) => !activeMatchPlayers.some((player) => player.userId === person.id),
  );
  const cleanSearch = search.trim().toLowerCase();
  const availableUsers = users
    .filter((user) => !activeMatchPlayers.some((player) => player.userId === user.id))
    .filter((user) => {
      if (!cleanSearch) return true;
      return `${getDisplayName(user)} ${user.username || ""}`
        .toLowerCase()
        .includes(cleanSearch);
    })
    .slice(0, 8);
  const teams = list?.teams || [];
  const returnTeam = list?.returnTeam || null;
  const isOpen = list?.status === "open";
  const isInProgress = list?.status === "in_progress";
  const totalConfirmed = (list?.setters || []).length + (list?.players || []).length;
  const totalPresent = activeMatchPlayers.length;
  const usersById = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, user])),
    [users],
  );

  async function runAdminAction(actionName, action) {
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

    runAdminAction(`add-${user.id}`, () =>
      addVolleyMatchPlayer({
        listId: list.id,
        userData: user,
        overrides: {
          isSetter,
          sex: user.sex || "male",
        },
      }),
    );
  }

  function handleAddGhost() {
    if (!list || !ghostName.trim()) return;

    runAdminAction("ghost", async () => {
      await addGhostPlayer({
        listId: list.id,
        displayName: ghostName,
        sex: ghostSex,
        isSetter: ghostSetter,
      });
      setGhostName("");
      setGhostSex("male");
      setGhostSetter(false);
    });
  }

  function handleSelectPlayer(player) {
    if (!player) return;

    if (selectedEntryId && selectedEntryId !== player.entryId) {
      runAdminAction("swap", () =>
        swapMatchPlayers({
          listId: list.id,
          firstEntryId: selectedEntryId,
          secondEntryId: player.entryId,
        }),
      );
      setSelectedEntryId(null);
      return;
    }

    setSelectedEntryId((current) =>
      current === player.entryId ? null : player.entryId,
    );
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

  async function handleConfirmRemove() {
    if (!list || !removeTarget) return;

    await runAdminAction(`remove-${removeTarget.entryId}`, () =>
      removeMatchPlayer({
        listId: list.id,
        entryId: removeTarget.entryId,
      }),
    );
    setRemoveTarget(null);
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
    <main className="admin-volley-page min-h-screen px-5 pb-28 pt-6 text-white" style={{ backgroundImage: `url(${generalBackground})` }}>
      <section className="mx-auto w-full max-w-[420px] space-y-4">
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

            {!list ? (
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

                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-black text-app-primary">
                        {isOpen ? totalConfirmed : totalPresent}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowCurrentList(true)}
                        className="profile-modal-close flex h-10 w-10 items-center justify-center text-app-primary"
                        aria-label="Ver lista atual"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </div>
                </section>

                <div className={`grid gap-2 ${isOpen ? "grid-cols-2" : "grid-cols-1"}`}>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => setConfirmAction("start")}
                      disabled={busyAction === "start-match"}
                      className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-app-primary text-sm font-black text-[#17231f] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-[#66736b]"
                    >
                      <Volleyball size={16} />
                      {busyAction === "start-match" ? "..." : "Iniciar lista"}
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
                </div>

                {isOpen && (
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

                {isOpen && (
                  <>
                    <PresenceCard
                      title="Levantadores"
                      icon={Crown}
                      people={list.setters || []}
                      limit={list.settersLimit}
                    />

                    <PresenceCard
                      title="Jogadores"
                      icon={Volleyball}
                      people={list.players || []}
                      limit={list.playersLimit}
                    />
                  </>
                )}

                {isInProgress && (
                  <section className="admin-volley-card admin-volley-rules p-3">
                    <button
                      type="button"
                      onClick={() => setShowRules((current) => !current)}
                      className="flex h-10 w-full items-center justify-between rounded-2xl bg-white/[0.04] px-3 text-sm font-black text-[#fffaf0] active:scale-[0.98]"
                    >
                      <span>Regras</span>
                      <span className="text-app-primary">
                        {showRules ? "▲" : "▼"}
                      </span>
                    </button>

                    {showRules && (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            runAdminAction("women-rule", () =>
                              toggleVolleyRule({
                                listId: list.id,
                                rule: "womenRuleMode",
                                value: list.womenRuleMode === "two" ? "one" : "two",
                              }),
                            )
                          }
                          className={`h-10 rounded-2xl text-xs font-black active:scale-[0.98] ${
                            list.womenRuleMode === "two"
                              ? "bg-app-accent text-white"
                              : "bg-white/[0.05] text-[#9aa89f]"
                          }`}
                        >
                          {list.womenRuleMode === "two" ? "2 mulheres" : "1 mulher"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            runAdminAction("exit-rule", () =>
                              toggleVolleyRule({
                                listId: list.id,
                                rule: "exitAfterTwoWins",
                                value: !list.exitAfterTwoWins,
                              }),
                            )
                          }
                          className={`h-10 rounded-2xl text-xs font-black active:scale-[0.98] ${
                            list.exitAfterTwoWins
                              ? "bg-app-primary text-[#17231f]"
                              : "bg-white/[0.05] text-[#9aa89f]"
                          }`}
                        >
                          Sai 2
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            runAdminAction("undo", () =>
                              undoVolleyListAction({ listId: list.id }),
                            )
                          }
                          className="flex h-10 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] text-xs font-black text-[#fffaf0] active:scale-[0.98]"
                        >
                          <RotateCcw size={13} />
                          Desfazer
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {isInProgress && (
                  <>
                    {returnTeam && (
                      <TeamCard
                        title="Volta"
                        team={returnTeam}
                        playersByEntryId={playersByEntryId}
                        selectedEntryId={selectedEntryId}
                        onSelectPlayer={handleSelectPlayer}
                        onRemovePlayer={setRemoveTarget}
                        onToggleSetter={handleToggleSetter}
                        onToggleSex={handleToggleSex}
                      />
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      {teams.slice(0, 2).map((team, index) => (
                        <TeamCard
                          key={team.id}
                          title={`Time ${index + 1}`}
                          team={team}
                          canWin={teams.length > 1}
                          onWin={() =>
                            runAdminAction(`win-${index}`, () =>
                              recordTeamWin({
                                listId: list.id,
                                winningTeamIndex: index,
                              }),
                            )
                          }
                          playersByEntryId={playersByEntryId}
                          selectedEntryId={selectedEntryId}
                          onSelectPlayer={handleSelectPlayer}
                          onRemovePlayer={setRemoveTarget}
                          onToggleSetter={handleToggleSetter}
                          onToggleSex={handleToggleSex}
                        />
                      ))}
                    </div>

                    {teams.slice(2).map((team, index) => (
                      <TeamCard
                        key={team.id}
                        title={`${index + 1}º Proxima`}
                        team={team}
                        playersByEntryId={playersByEntryId}
                        selectedEntryId={selectedEntryId}
                        onSelectPlayer={handleSelectPlayer}
                        onRemovePlayer={setRemoveTarget}
                        onToggleSetter={handleToggleSetter}
                        onToggleSex={handleToggleSex}
                      />
                    ))}
                  </>
                )}

                {isInProgress && (
                  <>
                    <section className="admin-volley-card admin-volley-arrivals p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <UserRoundPlus size={17} className="text-app-primary" />
                        <h2 className="text-sm font-black text-[#fffaf0]">
                          Adicionar por chegada
                        </h2>
                      </div>

                      {!!availableConfirmed.length && (
                        <div className="mb-3">
                          <p className="mb-2 text-xs font-black text-[#9aa89f]">
                            Confirmados
                          </p>
                          <div className="space-y-2">
                            {availableConfirmed.map((person) => (
                              <button
                                key={person.id}
                                type="button"
                                onClick={() =>
                                  handleAddUser(
                                    users.find((user) => user.id === person.id) || person,
                                    (list.setters || []).some((item) => item.id === person.id),
                                  )
                                }
                                className="flex h-10 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-[#fffaf0] active:scale-[0.98]"
                              >
                                {person.name || person.username}
                                <Plus size={15} className="text-app-primary" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar membro fora da lista"
                        className="mb-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-[#66736b] focus:border-app-primary/40"
                      />

                      <div className="max-h-56 space-y-2 overflow-y-auto">
                        {availableUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleAddUser(user)}
                            className="flex h-10 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-[#fffaf0] active:scale-[0.98]"
                          >
                            <span className="truncate">{getDisplayName(user)}</span>
                            <Plus size={15} className="text-app-primary" />
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="admin-volley-card admin-volley-ghost p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <Volleyball size={17} className="text-app-primary" />
                        <h2 className="text-sm font-black text-[#fffaf0]">
                          Ghost
                        </h2>
                      </div>

                      <input
                        value={ghostName}
                        onChange={(event) => setGhostName(event.target.value)}
                        placeholder="Nome do jogador temporario"
                        className="mb-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-[#66736b] focus:border-app-primary/40"
                      />

                      <div className="mb-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setGhostSex((current) =>
                              current === "female" ? "male" : "female",
                            )
                          }
                          className={`h-10 rounded-2xl text-xs font-black ${
                            ghostSex === "female"
                              ? "bg-app-accent text-white"
                              : "bg-white/[0.05] text-[#9aa89f]"
                          }`}
                        >
                          {ghostSex === "female" ? "Mulher" : "Homem"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setGhostSetter((current) => !current)}
                          className={`h-10 rounded-2xl text-xs font-black ${
                            ghostSetter
                              ? "bg-app-primary text-[#17231f]"
                              : "bg-white/[0.05] text-[#9aa89f]"
                          }`}
                        >
                          Levantador
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddGhost}
                        disabled={!ghostName.trim() || busyAction === "ghost"}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-app-primary text-sm font-black text-[#17231f] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-[#66736b]"
                      >
                        <Plus size={16} />
                        Adicionar ghost
                      </button>
                    </section>
                  </>
                )}
              </>
            )}
          </>
        )}
      </section>

      {removeTarget && (
        <ConfirmDeleteModal
          title="Remover da pelada?"
          description={`Deseja remover ${removeTarget.displayName || "esse jogador"} da lista?`}
          confirmText="Remover"
          isLoading={busyAction === `remove-${removeTarget.entryId}`}
          onClose={() => setRemoveTarget(null)}
          onConfirm={handleConfirmRemove}
        />
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
              await runAdminAction("finish", () => finishVolleyList({ listId: list.id }));
            }
            setConfirmAction(null);
          }}
        />
      )}

      {showCurrentList && list && (
        <CurrentListModal
          list={list}
          usersById={usersById}
          onClose={() => setShowCurrentList(false)}
        />
      )}
    </main>
  );
}
