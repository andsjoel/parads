/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Crown,
  PartyPopper,
  Play,
  ShieldCheck,
  UserPlus,
  Users,
  Volleyball,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import {
  PlayerMiniCard,
  ProfileStickerModal,
} from "../components/profile/ProfileCardPreview";
import { getPublicProfileBundles } from "../services/publicProfileService";
import {
  createVolleyList,
  finishVolleyList,
  getActiveVolleyList,
  joinVolleyList,
  leaveVolleyList,
  removeVolleyListParticipant,
  startVolleyMatch,
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

function ListGroup({
  title,
  icon: Icon,
  limit,
  people,
  emptyText,
  actionLabel,
  onAction,
  onRemove,
  disabledAction,
  isBusy,
  profilesById,
  onOpenProfile,
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
          type="button"
          onClick={onAction}
          disabled={disabledAction || isBusy}
          className={`
            rounded-xl px-3 py-2 text-xs font-black transition active:scale-[0.98]
            ${
              disabledAction || isBusy
                ? "cursor-not-allowed bg-white/[0.04] text-[#66736b]"
                : "bg-app-primary text-[#17231f]"
            }
          `}
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
            <div
              key={person.id}
              className="flex items-center gap-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[10px] font-black text-app-primary">
                {index + 1}
              </span>

              <PlayerMiniCard
                person={person}
                profileBundle={profilesById[person.id]}
                onOpen={() => onOpenProfile(person)}
                onRemove={onRemove ? () => onRemove(person) : null}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyListState({ isAdmin, onStart, isSaving }) {
  const [date, setDate] = useState("");

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#17231f]/75 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-app-primary/15 text-app-primary">
          <PartyPopper size={24} />
        </div>

        <div>
          <p className="text-xl font-black text-[#fffaf0]">
            A lista ainda nao abriu
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#9aa89f]">
            Quando um admin liberar a pelada, todo mundo entra por aqui: jogador,
            levantador e convidados.
          </p>
        </div>
      </div>

      {isAdmin ? (
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <label className="mb-2 block text-xs font-bold text-[#9aa89f]">
            Data da pelada
          </label>

          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mb-3 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-[#fffaf0] outline-none focus:border-app-primary/40"
          />

          <button
            type="button"
            onClick={() => onStart(date)}
            disabled={!date || isSaving}
            className={`
              flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black active:scale-[0.98]
              ${
                date && !isSaving
                  ? "bg-app-primary text-[#17231f] shadow-[0_0_24px_rgba(255,183,3,0.22)]"
                  : "cursor-not-allowed bg-white/[0.04] text-[#66736b]"
              }
            `}
          >
            <CalendarPlus size={18} />
            {isSaving ? "Abrindo..." : "Abrir lista"}
          </button>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-[#9aa89f]">
          Fica de olho. Assim que a lista abrir, os botoes de entrada aparecem.
        </div>
      )}
    </section>
  );
}

export default function MatchList() {
  const { userData, isAdmin, isMember } = useAuth();

  const [list, setList] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [profilesById, setProfilesById] = useState({});
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  async function loadList() {
    setIsLoading(true);

    try {
      setErrorMessage("");
      const activeList = await getActiveVolleyList();
      setList(activeList);
    } catch (error) {
      console.error(error);
      setList(null);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    async function loadParticipantProfiles() {
      const participants = [
        ...(list?.setters || []),
        ...(list?.players || []),
      ];

      if (!participants.length) {
        setProfilesById({});
        return;
      }

      try {
        const nextProfilesById = await getPublicProfileBundles(
          participants.map((person) => person.id),
        );

        setProfilesById(nextProfilesById);
      } catch (error) {
        console.error(error);
      }
    }

    loadParticipantProfiles();
  }, [list]);

  const isListOpen = list?.status === "open";
  const setters = list?.setters || [];
  const players = list?.players || [];
  const totalConfirmed = setters.length + players.length;
  const totalLimit = list?.playersLimit || 26;

  const userGroup = useMemo(() => {
    if (!list || !userData?.id) return null;

    if ((list.setters || []).some((person) => person.id === userData.id)) {
      return "setter";
    }

    if ((list.players || []).some((person) => person.id === userData.id)) {
      return "player";
    }

    return null;
  }, [list, userData?.id]);

  const canChangeList = isMember && isListOpen;

  async function runListAction(actionName, action) {
    try {
      setErrorMessage("");
      setBusyAction(actionName);

      await action();
      await loadList();
    } catch (error) {
      console.error(error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  function handleCreateList(date) {
    if (!date || !userData || !isAdmin) return;

    runListAction("create", () =>
      createVolleyList({
        date,
        adminUser: userData,
      }),
    );
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

  function handleRemove(person) {
    setRemoveTarget(person);
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    if (!list || !isAdmin) return;

    await runListAction(`remove-${removeTarget.id}`, () =>
      removeVolleyListParticipant({
        listId: list.id,
        userId: removeTarget.id,
      }),
    );

    setRemoveTarget(null);
  }

  function handleStartMatch() {
    if (!list || !isAdmin) return;

    runListAction("start-match", () => startVolleyMatch({ listId: list.id }));
  }

  function handleFinishList() {
    if (!list || !isAdmin) return;

    runListAction("finish", () => finishVolleyList({ listId: list.id }));
  }

  async function handleOpenProfile(person) {
    setSelectedPerson(person);

    if (profilesById[person.id]) return;

    try {
      setIsLoadingProfile(true);
      const nextProfilesById = await getPublicProfileBundles([person.id]);
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
      <main className="flex min-h-screen items-center justify-center px-5 pb-28 pt-6">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-app-primary shadow-[0_0_18px_rgba(255,183,3,0.35)]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-28 pt-6 text-white">
      <section className="mx-auto w-full max-w-[420px] space-y-4">
        <header className="rounded-[1.5rem] border border-white/10 bg-[#17231f]/70 p-4 shadow-[0_14px_38px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight text-[#fffaf0]">
                Lista do Volei
              </h1>
              <p className="mt-0.5 truncate text-xs font-semibold text-[#9aa89f]">
                {list
                  ? `${formatDate(list.date)} · ${totalConfirmed}/${totalLimit} confirmados`
                  : "Aguardando abertura da lista"}
              </p>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-app-primary/15 text-app-primary">
              <Volleyball size={20} />
            </div>
          </div>

          {list && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
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
            </div>
          )}
        </header>

        {errorMessage && (
          <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {errorMessage}
          </p>
        )}

        {!list && (
          <EmptyListState
            isAdmin={isAdmin}
            isSaving={busyAction === "create"}
            onStart={handleCreateList}
          />
        )}

        {list && (
          <>
            {!isListOpen && (
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-bold text-[#9aa89f]">
                  A pelada ja foi iniciada. Agora a lista fica travada para o
                  controle da quadra.
                </p>
              </div>
            )}

            {!isMember && !isAdmin && (
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-bold text-[#9aa89f]">
                  Convidados podem acompanhar a lista. Para entrar sozinho, tem
                  que virar membro da casa.
                </p>
              </div>
            )}

            <ListGroup
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
              onAction={() =>
                userGroup === "setter" ? handleLeave() : handleJoin("setter")
              }
              onRemove={isAdmin && isListOpen ? handleRemove : null}
            />

            <ListGroup
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
              onAction={() =>
                userGroup === "player" ? handleLeave() : handleJoin("player")
              }
              onRemove={isAdmin && isListOpen ? handleRemove : null}
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
                    Pedido preparado para o proximo fluxo
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-[#66736b]"
              >
                Pedir vaga para convidado
              </button>
            </section>

            {isAdmin && (
              <section className="space-y-3 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={17} className="text-app-primary" />
                  <h2 className="text-sm font-black text-[#fffaf0]">
                    Controle do admin
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleStartMatch}
                  disabled={!isListOpen || busyAction === "start-match"}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-app-primary px-4 py-3 text-sm font-black text-[#17231f] shadow-[0_0_24px_rgba(255,183,3,0.18)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-[#66736b] disabled:shadow-none"
                >
                  <Play size={17} />
                  {busyAction === "start-match"
                    ? "Iniciando..."
                    : "Iniciar pelada"}
                </button>

                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-[#66736b] active:scale-[0.98]"
                >
                  Adicionar usuario manualmente
                </button>

                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-[#66736b] active:scale-[0.98]"
                >
                  Adicionar convidado manualmente
                </button>

                <button
                  type="button"
                  onClick={handleFinishList}
                  disabled={busyAction === "finish"}
                  className="w-full rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-black text-red-300 active:scale-[0.98] disabled:opacity-50"
                >
                  {busyAction === "finish" ? "Finalizando..." : "Encerrar lista"}
                </button>
              </section>
            )}

            {!isAdmin && (
              <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <Users size={17} className="text-app-primary" />
                  <p className="text-sm font-black text-[#fffaf0]">
                    Resumo da pelada
                  </p>
                </div>

                <p className="mt-2 text-sm leading-relaxed text-[#9aa89f]">
                  Escolha uma vaga, acompanhe a lista e chegue pronto. O resto a
                  quadra resolve.
                </p>
              </section>
            )}
          </>
        )}
      </section>

      {selectedPerson && (
        <ProfileStickerModal
          fallbackPerson={selectedPerson}
          profileBundle={profilesById[selectedPerson.id]}
          isLoading={isLoadingProfile && !profilesById[selectedPerson.id]}
          onClose={() => setSelectedPerson(null)}
        />
      )}

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
