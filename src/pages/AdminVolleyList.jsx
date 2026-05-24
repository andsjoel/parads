/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  Crown,
  Play,
  ShieldCheck,
  Trash2,
  Volleyball,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import { useAuth } from "../contexts/AuthContext";
import {
  createVolleyList,
  finishVolleyList,
  removeVolleyListParticipant,
  startVolleyMatch,
  subscribeActiveVolleyList,
} from "../services/volleyListService";

function formatDate(date) {
  if (!date) return "Data nao definida";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function getErrorMessage(error) {
  if (error?.code === "permission-denied") {
    return "Sem permissao para operar a lista.";
  }

  return error?.message || "Nao foi possivel atualizar a lista.";
}

function AdminListGroup({ title, icon: Icon, people, limit, onRemove, isOpen }) {
  return (
    <section className="rounded-[1.4rem] border border-white/10 bg-[#17231f]/72 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
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
              className="flex min-h-11 items-center justify-between gap-3 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
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

              {isOpen && (
                <button
                  type="button"
                  onClick={() => onRemove(person)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-300/15 bg-red-500/10 text-red-300 active:scale-95"
                >
                  <Trash2 size={14} />
                </button>
              )}
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

export default function AdminVolleyList() {
  const { isAdmin, userData } = useAuth();

  const [list, setList] = useState(null);
  const [date, setDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);

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
    if (!date || !userData || !isAdmin) return;

    runAdminAction("create", async () => {
      await createVolleyList({
        date,
        adminUser: userData,
      });

      setDate("");
    });
  }

  function handleStartMatch() {
    if (!list || !isAdmin) return;

    runAdminAction("start-match", () => startVolleyMatch({ listId: list.id }));
  }

  function handleFinishList() {
    if (!list || !isAdmin) return;

    runAdminAction("finish", () => finishVolleyList({ listId: list.id }));
  }

  async function handleConfirmRemove() {
    if (!list || !removeTarget || !isAdmin) return;

    await runAdminAction(`remove-${removeTarget.id}`, () =>
      removeVolleyListParticipant({
        listId: list.id,
        userId: removeTarget.id,
      }),
    );

    setRemoveTarget(null);
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen px-5 pb-28 pt-6 text-white">
        <section className="mx-auto flex min-h-[60vh] w-full max-w-[420px] items-center justify-center">
          <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.04] p-6 text-center">
            <ShieldCheck className="mx-auto mb-3 text-app-primary" size={28} />
            <p className="text-lg font-black text-[#fffaf0]">
              Somente administradores.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const isOpen = list?.status === "open";
  const setters = list?.setters || [];
  const players = list?.players || [];
  const totalConfirmed = setters.length + players.length;
  const totalLimit = (list?.settersLimit || 0) + (list?.playersLimit || 0);

  return (
    <main className="min-h-screen px-5 pb-28 pt-6 text-white">
      <section className="mx-auto w-full max-w-[420px] space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400"
            >
              <ArrowLeft size={18} />
            </Link>

            <div>
              <h1 className="text-xl font-black text-[#fffaf0]">Lista</h1>
              <p className="text-sm font-semibold text-[#9aa89f]">
                Operacao da pelada
              </p>
            </div>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-app-primary/15 text-app-primary">
            <ShieldCheck size={19} />
          </div>
        </header>

        {isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-app-primary" />
          </div>
        ) : (
          <>
            {errorMessage && (
              <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
                {errorMessage}
              </p>
            )}

            {!list ? (
              <section className="rounded-[1.5rem] border border-white/10 bg-[#17231f]/72 p-4 shadow-[0_12px_34px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarPlus size={18} className="text-app-primary" />
                  <h2 className="text-sm font-black text-[#fffaf0]">
                    Abrir lista
                  </h2>
                </div>

                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mb-3 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-[#fffaf0] outline-none focus:border-app-primary/40"
                />

                <button
                  type="button"
                  onClick={handleCreateList}
                  disabled={!date || busyAction === "create"}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-app-primary text-sm font-black text-[#17231f] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-[#66736b]"
                >
                  <CalendarPlus size={17} />
                  {busyAction === "create" ? "Abrindo..." : "Abrir lista"}
                </button>
              </section>
            ) : (
              <>
                <section className="rounded-[1.5rem] border border-white/10 bg-[#17231f]/72 p-4 shadow-[0_12px_34px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-app-primary">
                        {list.status === "open" ? "Aberta" : "Em andamento"}
                      </p>
                      <h2 className="mt-1 text-lg font-black text-[#fffaf0]">
                        {formatDate(list.date)}
                      </h2>
                    </div>

                    <p className="text-2xl font-black text-app-primary">
                      {totalConfirmed}/{totalLimit}
                    </p>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-app-primary transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (totalConfirmed / totalLimit) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </section>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleStartMatch}
                    disabled={!isOpen || busyAction === "start-match"}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-app-primary text-sm font-black text-[#17231f] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-[#66736b]"
                  >
                    <Play size={16} />
                    {busyAction === "start-match" ? "..." : "Iniciar"}
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishList}
                    disabled={busyAction === "finish"}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-500/10 text-sm font-black text-red-300 active:scale-[0.98] disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    {busyAction === "finish" ? "..." : "Encerrar"}
                  </button>
                </div>

                <AdminListGroup
                  title="Levantadores"
                  icon={Crown}
                  people={setters}
                  limit={list.settersLimit}
                  isOpen={isOpen}
                  onRemove={setRemoveTarget}
                />

                <AdminListGroup
                  title="Jogadores"
                  icon={Volleyball}
                  people={players}
                  limit={list.playersLimit}
                  isOpen={isOpen}
                  onRemove={setRemoveTarget}
                />
              </>
            )}
          </>
        )}
      </section>

      {removeTarget && (
        <ConfirmDeleteModal
          title="Remover da lista?"
          description={`Deseja remover ${removeTarget.name || "esse jogador"} da lista?`}
          confirmText="Remover"
          isLoading={busyAction === `remove-${removeTarget.id}`}
          onClose={() => setRemoveTarget(null)}
          onConfirm={handleConfirmRemove}
        />
      )}
    </main>
  );
}
