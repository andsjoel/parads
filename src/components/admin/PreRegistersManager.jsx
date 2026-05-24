import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Mars,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Venus,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  createPreRegister,
  getPreRegisters,
} from "../../services/preRegisterService";

import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";

import { deleteUserCascadeByPreRegister } from "../../services/userService";

function onlyNumbers(value) {
  return value.replace(/\D/g, "");
}

function maskPhone(value) {
  const numbers = onlyNumbers(value).slice(0, 11);

  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 3) return `${numbers.slice(0, 2)} ${numbers.slice(2)}`;
  if (numbers.length <= 7) {
    return `${numbers.slice(0, 2)} ${numbers.slice(2, 3)} ${numbers.slice(3)}`;
  }

  return `${numbers.slice(0, 2)} ${numbers.slice(2, 3)} ${numbers.slice(
    3,
    7,
  )}-${numbers.slice(7)}`;
}

const roleOptions = [
  { label: "Membro", value: "member" },
  { label: "Convidado", value: "guest" },
  { label: "Admin", value: "admin" },
];

const sexOptions = [
  { label: "Homem", value: "male", Icon: Mars },
  { label: "Mulher", value: "female", Icon: Venus },
];

export default function PreRegistersManager() {
  const [preRegisters, setPreRegisters] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("member");
  const [sex, setSex] = useState("male");
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false); 

  async function loadPreRegisters() {
    setIsLoading(true);

    try {
      const data = await getPreRegisters();
      setPreRegisters(data);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPreRegisters();
  }, []);

  const filteredPreRegisters = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    const searchNumbers = onlyNumbers(search);

    return preRegisters.filter((item) => {
      const matchesSearch =
        !cleanSearch ||
        item.fullName?.toLowerCase().includes(cleanSearch) ||
        item.phone?.includes(searchNumbers);

      const matchesType = typeFilter === "all" || item.role === typeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "claimed" && item.claimed) ||
        (statusFilter === "pending" && !item.claimed);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [preRegisters, search, typeFilter, statusFilter]);

  async function handleCreatePreRegister(event) {
    event.preventDefault();

    const phoneNumbers = onlyNumbers(phone);

    if (!fullName.trim() || phoneNumbers.length !== 11) return;

    try {
      setIsSaving(true);

      await createPreRegister({
        fullName,
        phone: phoneNumbers,
        type: "member",
        role,
        sex,
      });

      setFullName("");
      setPhone("");
      setRole("member");
      setSex("male");
      setShowModal(false);

      await loadPreRegisters();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDeletePreRegister() {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);

      await deleteUserCascadeByPreRegister(deleteTarget.id);

      setDeleteTarget(null);

      setPreRegisters((current) =>
        current.filter((preRegister) => preRegister.id !== deleteTarget.id),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="min-h-screen px-5 pb-28 pt-6 text-white">
      <section className="mx-auto flex w-full max-w-[420px] flex-col">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400"
            >
              <ArrowLeft size={18} />
            </Link>

            <div>
              <h1 className="text-xl font-black">Convites</h1>
              <p className="text-sm text-app-muted">
                Pessoas esperando entrar no time
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-app-primary text-[#1b1300] shadow-[0_0_22px_rgba(255,183,3,0.38)] active:scale-95"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="mb-4 rounded-[1.5rem] border border-white/10 bg-[#17231f]/70 p-3 shadow-[0_14px_35px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <div className="flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4">
            <Search size={17} className="text-slate-500" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou celular"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-10 rounded-full border border-white/10 bg-[#16231f] px-3 text-sm text-stone-300 outline-none focus:border-app-primary/40"
            >
              <option value="all">Todos</option>
              <option value="member">Membros</option>
              <option value="guest">Convidados</option>
              <option value="admin">Admins</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-full border border-white/10 bg-[#16231f] px-3 text-sm text-stone-300 outline-none focus:border-app-primary/40"
            >
              <option value="all">Status</option>
              <option value="claimed">Cadastrados</option>
              <option value="pending">Pendentes</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 flex justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-app-primary" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredPreRegisters.map((item) => (
              <div
                key={item.id}
                className="rounded-[1.5rem] border border-white/10 bg-[#17231f]/70 p-4 shadow-[0_14px_35px_rgba(0,0,0,0.20)] backdrop-blur-2xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black text-white">
                        {item.fullName}
                      </p>

                      {item.claimed && (
                        <CheckCircle
                          size={16}
                          className="shrink-0 text-app-primary"
                        />
                      )}
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      +{item.phone}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition hover:text-red-400 active:scale-95"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-400">
                    {item.role === "admin"
                      ? "Admin"
                      : item.role === "guest"
                        ? "Convidado"
                        : "Membro"}
                  </span>

                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-400">
                    {item.claimed ? "Cadastrado" : "Pendente"}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-400">
                    {item.sex === "female" ? (
                      <Venus size={13} className="text-app-accent" />
                    ) : (
                      <Mars size={13} className="text-app-secondary" />
                    )}
                    {item.sex === "female" ? "Mulher" : "Homem"}
                  </span>
                </div>
              </div>
            ))}

            {!filteredPreRegisters.length && (
              <p className="mt-8 text-center text-sm text-slate-500">
                Nenhum convite encontrado.
              </p>
            )}
          </div>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-5 pb-5 backdrop-blur-sm">
          <form
            onSubmit={handleCreatePreRegister}
            className="w-full max-w-[420px] rounded-[1.8rem] border border-white/10 bg-[#13201c]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-3xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">Novo convite</h2>
                <p className="text-sm text-slate-500">
                  Adicionar usuário autorizado
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nome completo"
                className="h-12 rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-app-primary/30 focus:ring-4 focus:ring-app-primary/10"
              />

              <input
                value={phone}
                onChange={(event) => setPhone(maskPhone(event.target.value))}
                placeholder="61 9 9999-9999"
                inputMode="numeric"
                className="h-12 rounded-[1.4rem] border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-app-primary/30 focus:ring-4 focus:ring-app-primary/10"
              />

              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="h-10 rounded-full border border-white/10 bg-[#16231f] px-3 text-sm text-stone-300 outline-none focus:border-app-primary/40"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div
                className="relative grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.06] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                role="radiogroup"
                aria-label="Sexo"
              >
                <span
                  className={`absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full transition-all duration-300 ease-out ${
                    sex === "female"
                      ? "left-[calc(50%+0.125rem)] bg-app-accent shadow-[0_0_24px_rgba(251,113,133,0.34)]"
                      : "left-1 bg-app-secondary shadow-[0_0_24px_rgba(45,212,191,0.30)]"
                  }`}
                />

                {sexOptions.map(({ label, value, Icon }) => {
                  const isSelected = sex === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSex(value)}
                      className={`relative z-10 flex h-11 items-center justify-center gap-2 rounded-full text-sm font-black transition-all duration-300 active:scale-[0.98] ${
                        isSelected
                          ? "scale-[1.02] text-slate-950"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={`transition-transform duration-300 ${
                          isSelected ? "scale-110" : ""
                        }`}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-app-primary text-sm font-black text-slate-950 shadow-[0_10px_30px_rgba(74,222,128,0.28)] active:scale-[0.98] disabled:opacity-50"
              >
                <UserPlus size={18} />
                {isSaving ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Excluir convite?"
          description={`Os dados de ${deleteTarget.fullName} será removido para sempre.`}
          confirmText="Excluir"
          isLoading={isDeleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDeletePreRegister}
        />
      )}
    </main>
  );
}
