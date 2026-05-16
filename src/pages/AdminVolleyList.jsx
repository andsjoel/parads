import { useMemo, useState } from "react";
import {
  CalendarPlus,
  Crown,
  PartyPopper,
  UserPlus,
  Users,
  Volleyball,
  X,
} from "lucide-react";
import { TbRuler } from "react-icons/tb";

const MOCK_IS_ADMIN = TbRuler;
const MOCK_HAS_ACTIVE_LIST = false;

const loggedUser = {
  id: "user-logged",
  name: "Anderson",
};

const initialList = MOCK_HAS_ACTIVE_LIST
  ? {
      id: "lista-domingo",
      title: "Lista do Vôlei",
      date: "2026-05-17",
      status: "open",
      settersLimit: 4,
      playersLimit: 26,
      setters: [
        { id: "1", name: "Lucas" },
        { id: "2", name: "Rafael" },
      ],
      players: [{ id: "3", name: "Pedro" }],
      guests: [],
    }
  : null;

function formatDate(date) {
  if (!date) return "Data não definida";

  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function ListGroup({
  title,
  icon: Icon,
  limit,
  people,
  emptyText,
  onJoin,
  onRemove,
  joinLabel,
  disabledJoin,
}) {
  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-[#17231f]/75 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
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
          onClick={onJoin}
          disabled={disabledJoin}
          className={`
            rounded-xl px-3 py-2 text-xs font-black transition active:scale-[0.98]
            ${
              disabledJoin
                ? "cursor-not-allowed bg-white/[0.04] text-[#66736b]"
                : "bg-app-primary text-[#17231f]"
            }
          `}
        >
          {joinLabel}
        </button>
      </div>

      {people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-[#9aa89f]">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {people.map((person, index) => (
            <div
              key={person.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-xs font-black text-app-primary">
                  {index + 1}
                </span>

                <span className="text-sm font-semibold text-[#fffaf0]">
                  {person.name}
                </span>
              </div>

              {onRemove && (
                <button
                  onClick={() => onRemove(person.id)}
                  className="rounded-full p-2 text-[#9aa89f] transition hover:bg-red-500/10 hover:text-red-300"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NoListMessage() {
  return (
    <section className="flex min-h-[58vh] items-center justify-center">
      <div className="w-full rounded-[2rem] border border-dashed border-white/10 bg-white/[0.04] p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-app-primary/15 text-app-primary">
          <PartyPopper size={26} />
        </div>

        <p className="text-lg font-black text-[#fffaf0]">
          Calma, jogador
        </p>

        <p className="mt-2 text-sm leading-relaxed text-[#9aa89f]">
          A lista dessa pelada ainda não foi aberta.
        </p>
      </div>
    </section>
  );
}

function AdminStartListCard({ list, onStart }) {
  const [date, setDate] = useState("");

  return (
    <header className="rounded-[1.9rem] border border-white/10 bg-[#17231f]/75 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-app-primary">
            Administração
          </p>

          <h1 className="text-2xl font-black tracking-tight text-[#fffaf0]">
            Lista do Vôlei
          </h1>

          <p className="mt-1 text-sm text-[#9aa89f]">
            {list
              ? `Pelada marcada para ${formatDate(list.date)}`
              : "Nenhuma lista aberta. Escolha a data e inicie a próxima pelada."}
          </p>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-app-primary/15 text-app-primary">
          <CalendarPlus size={22} />
        </div>
      </div>

      {!list && (
        <>
          <label className="mb-2 block text-xs font-bold text-[#9aa89f]">
            Data do jogo
          </label>

          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mb-3 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-[#fffaf0] outline-none focus:border-app-primary/40"
          />

          <button
            onClick={() => onStart(date)}
            disabled={!date}
            className={`
              w-full rounded-2xl px-4 py-3 text-sm font-black active:scale-[0.98]
              ${
                date
                  ? "bg-app-primary text-[#17231f] shadow-[0_0_24px_rgba(255,183,3,0.22)]"
                  : "cursor-not-allowed bg-white/[0.04] text-[#66736b]"
              }
            `}
          >
            Iniciar lista
          </button>
        </>
      )}
    </header>
  );
}

export default function AdminVolleyList() {
  const [list, setList] = useState(initialList);

  const isAdmin = MOCK_IS_ADMIN;

  const userGroup = useMemo(() => {
    if (!list) return null;

    const isSetter = list.setters.some((person) => person.id === loggedUser.id);
    const isPlayer = list.players.some((person) => person.id === loggedUser.id);

    if (isSetter) return "setter";
    if (isPlayer) return "player";

    return null;
  }, [list]);

  function handleStartList(date) {
    setList({
      id: `lista-${date}`,
      title: "Lista do Vôlei",
      date,
      status: "open",
      settersLimit: 4,
      playersLimit: 26,
      setters: [],
      players: [],
      guests: [],
    });
  }

  function handleJoin(group) {
    if (!list || userGroup) return;

    if (group === "setter" && list.setters.length >= list.settersLimit) return;
    if (group === "player" && list.players.length >= list.playersLimit) return;

    setList((current) => {
      if (!current) return current;

      return {
        ...current,
        setters:
          group === "setter"
            ? [...current.setters, loggedUser]
            : current.setters,
        players:
          group === "player"
            ? [...current.players, loggedUser]
            : current.players,
      };
    });
  }

  function handleRemove(group, personId) {
    if (!isAdmin) return;

    setList((current) => {
      if (!current) return current;

      return {
        ...current,
        setters:
          group === "setter"
            ? current.setters.filter((person) => person.id !== personId)
            : current.setters,
        players:
          group === "player"
            ? current.players.filter((person) => person.id !== personId)
            : current.players,
      };
    });
  }

  return (
    <main className="min-h-screen px-5 pb-28 pt-6 text-white">
      <section className="mx-auto w-full max-w-[420px] space-y-4">
        {isAdmin && (
            <AdminStartListCard list={list} onStart={handleStartList} />
            )}

            {!list && !isAdmin && <NoListMessage />}

        {list && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-[#9aa89f]">Levantadores</p>
                <strong className="mt-1 block text-xl text-[#fffaf0]">
                  {list.setters.length}/{list.settersLimit}
                </strong>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-[#9aa89f]">Jogadores</p>
                <strong className="mt-1 block text-xl text-[#fffaf0]">
                  {list.players.length}/{list.playersLimit}
                </strong>
              </div>
            </div>

            {userGroup && (
              <div className="rounded-[1.4rem] border border-app-primary/20 bg-app-primary/10 p-4">
                <p className="text-sm font-bold text-app-primary">
                  Você já está na lista como{" "}
                  {userGroup === "setter" ? "levantador" : "jogador"}.
                </p>
              </div>
            )}

            <ListGroup
              title="Levantadores"
              icon={Crown}
              limit={list.settersLimit}
              people={list.setters}
              emptyText="Nenhum levantador confirmado ainda."
              joinLabel="Entrar"
              disabledJoin={!!userGroup || list.setters.length >= list.settersLimit}
              onJoin={() => handleJoin("setter")}
              onRemove={
                isAdmin ? (personId) => handleRemove("setter", personId) : null
              }
            />

            <ListGroup
              title="Jogadores"
              icon={Volleyball}
              limit={list.playersLimit}
              people={list.players}
              emptyText="Nenhum jogador confirmado ainda."
              joinLabel="Entrar"
              disabledJoin={!!userGroup || list.players.length >= list.playersLimit}
              onJoin={() => handleJoin("player")}
              onRemove={
                isAdmin ? (personId) => handleRemove("player", personId) : null
              }
            />

            <section className="rounded-[1.7rem] border border-white/10 bg-[#17231f]/75 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-app-primary/15 text-app-primary">
                  <UserPlus size={18} />
                </div>

                <div>
                  <h2 className="text-sm font-black text-[#fffaf0]">
                    Convidados
                  </h2>
                  <p className="text-xs text-[#9aa89f]">
                    Solicitações aguardando aprovação
                  </p>
                </div>
              </div>

              <button className="w-full rounded-2xl border border-app-primary/25 bg-app-primary/10 px-4 py-3 text-sm font-black text-app-primary active:scale-[0.98]">
                Solicitar convidado
              </button>
            </section>

            {isAdmin && (
              <section className="space-y-3 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <Users size={17} className="text-app-primary" />
                  <h2 className="text-sm font-black text-[#fffaf0]">
                    Ações do admin
                  </h2>
                </div>

                <button className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-[#fffaf0] active:scale-[0.98]">
                  Adicionar usuário manualmente
                </button>

                <button className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-[#fffaf0] active:scale-[0.98]">
                  Adicionar convidado manualmente
                </button>

                <button className="w-full rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-black text-red-300 active:scale-[0.98]">
                  Finalizar lista após a pelada
                </button>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}