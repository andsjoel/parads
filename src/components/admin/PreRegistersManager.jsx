/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
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
import OrbitLoader from "../../components/OrbitLoader";
import generalBackground from "../../assets/app-backgrounds/bg-geral.png";

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

const typeFilterOptions = [
  { label: "Todos", value: "all" },
  ...roleOptions.map((option) => ({ ...option, label: `${option.label}s` })),
];

const statusFilterOptions = [
  { label: "Status", value: "all" },
  { label: "Cadastrados", value: "claimed" },
  { label: "Pendentes", value: "pending" },
];

const sexOptions = [
  { label: "Homem", value: "male", Icon: Mars },
  { label: "Mulher", value: "female", Icon: Venus },
];

function IdvSelect({ value, onChange, options, ariaLabel, large = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    function closeMenu(event) {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`admin-select relative ${large ? "admin-select--large" : ""}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className={`admin-select-trigger ${isOpen ? "admin-select-trigger--open" : ""}`}
      >
        <span>{selected.label}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="admin-select-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`admin-select-option ${option.value === value ? "admin-select-option--selected" : ""}`}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [createdInvite, setCreatedInvite] = useState(null);
  const [expandedInviteId, setExpandedInviteId] = useState(null);

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

      const created = await createPreRegister({
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
      setCreatedInvite(created);

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
    <main className="admin-page min-h-screen px-5 pb-28 pt-6 text-white" style={{ backgroundImage: `url(${generalBackground})` }}>
      <section className="mx-auto flex w-full max-w-[420px] flex-col">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/menu"
              className="profile-modal-close flex h-10 w-10 items-center justify-center text-white/70"
            >
              <ArrowLeft size={18} />
            </Link>

            <h1 className="text-xl font-black">Convites</h1>
          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="admin-primary-action flex h-11 w-11 items-center justify-center active:scale-95"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="admin-panel mb-4 p-3">
          <div className="admin-search flex h-11 items-center gap-2 px-4">
            <Search size={17} className="text-slate-500" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou celular"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <IdvSelect value={typeFilter} onChange={setTypeFilter} options={typeFilterOptions} ariaLabel="Filtrar por tipo" />

            <IdvSelect value={statusFilter} onChange={setStatusFilter} options={statusFilterOptions} ariaLabel="Filtrar por status" />
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 flex justify-center">
            <OrbitLoader size={32} />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredPreRegisters.map((item) => {
              const isExpanded = expandedInviteId === item.id;
              const roleLabel = item.role === "admin" ? "Admin" : item.role === "guest" ? "Convidado" : "Membro";

              return (
                <div key={item.id} className={`admin-list-card admin-invite-card ${isExpanded ? "admin-invite-card--expanded" : ""}`}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedInviteId((current) => current === item.id ? null : item.id)}
                    className="flex h-14 w-full items-center justify-between gap-3 px-4 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-white">{item.fullName}</span>
                    <span className={`admin-invite-status ${item.claimed ? "admin-invite-status--claimed" : ""}`}>
                      {item.claimed ? "Cadastrado" : "Pendente"}
                    </span>
                    <ChevronDown size={17} className={`shrink-0 text-[#ff8b58] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  <div className={`admin-invite-details ${isExpanded ? "admin-invite-details--open" : ""}`}>
                    <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-4 pb-4 pt-1 text-xs">
                      <span className="text-white/38">celular</span>
                      <span className="text-right text-white/72">+{item.phone}</span>
                      <span className="text-white/38">tipo</span>
                      <span className="text-right text-white/72">{roleLabel}</span>
                      <span className="text-white/38">sexo</span>
                      <span className="inline-flex items-center justify-end gap-1 text-white/72">
                        {item.sex === "female" ? <Venus size={13} className="text-[#ff3299]" /> : <Mars size={13} className="text-[#ff713f]" />}
                        {item.sex === "female" ? "Mulher" : "Homem"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="admin-delete-action mx-4 mb-4 flex h-10 w-[calc(100%_-_2rem)] items-center justify-center gap-2 text-sm"
                    >
                      <Trash2 size={16} />
                      excluir convite
                    </button>
                  </div>
                </div>
              );
            })}

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
            className="profile-edit-modal w-full max-w-[420px] p-5"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-idv-title text-2xl">Novo convite</h2>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="profile-modal-close flex h-10 w-10 items-center justify-center text-white/70"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nome completo"
                className="admin-input h-12 px-4 text-sm text-white outline-none placeholder:text-white/30"
              />

              <input
                value={phone}
                onChange={(event) => setPhone(maskPhone(event.target.value))}
                placeholder="61 9 9999-9999"
                inputMode="numeric"
                className="admin-input h-12 px-4 text-sm text-white outline-none placeholder:text-white/30"
              />

              <IdvSelect value={role} onChange={setRole} options={roleOptions} ariaLabel="Tipo de acesso" large />

              <div
                className="relative grid h-12 grid-cols-2 overflow-hidden rounded-md border border-white/10 bg-black/25 p-1"
                role="radiogroup"
                aria-label="Sexo"
              >
                <span
                  className={`pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-[3px] transition-all duration-200 ease-out ${
                    sex === "female"
                      ? "translate-x-full bg-[#ff3299] shadow-[0_0_20px_rgba(255,50,153,0.3)]"
                      : "translate-x-0 bg-gradient-to-r from-[#ff3d2e] to-[#ff8a2e] shadow-[0_0_20px_rgba(255,80,42,0.24)]"
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
                      className={`relative z-10 flex items-center justify-center gap-2 text-sm font-black transition-colors active:scale-[0.98] ${
                        isSelected
                          ? "text-[#1a0504]"
                          : "text-[#9aa89f] hover:text-white"
                      }`}
                    >
                      <Icon
                        size={18}
                        className="transition-transform duration-200"
                      />
                      {label}
                    </button>
                  );
                })}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="admin-primary-action mt-2 flex h-12 items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <UserPlus size={18} />
                {isSaving ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {createdInvite && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 px-5 pb-5 backdrop-blur-sm">
          <div className="profile-edit-modal w-full max-w-[420px] p-5 text-center">
            <p className="text-sm text-slate-400">Codigo de primeiro acesso</p>
            <p className="mt-3 text-4xl text-[#ff713f]">
              {createdInvite.temporaryCode}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Envie este codigo para {createdInvite.fullName}. Ele nao sera exibido novamente.
            </p>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(createdInvite.temporaryCode)}
              className="admin-primary-action mt-5 flex h-12 w-full items-center justify-center gap-2 text-sm"
            >
              <Copy size={17} />
              Copiar codigo
            </button>
            <button
              type="button"
              onClick={() => setCreatedInvite(null)}
              className="mt-3 h-10 text-sm text-slate-400"
            >
              Fechar
            </button>
          </div>
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
