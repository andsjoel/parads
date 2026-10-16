/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Mars,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Venus,
  X,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  getPreRegisters,
  updatePreRegister,
  regenerateInviteAccessCode,
} from "../../services/preRegisterService";

import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";
import OrbitLoader from "../../components/OrbitLoader";
import InviteCreateModal from "./InviteCreateModal";
import generalBackground from "../../assets/app-backgrounds/bg-geral.png";

import { deleteUserCascadeByPreRegister } from "../../services/userService";
import { resetAccountPassword } from "../../services/passwordRecoveryService";

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
        <span className="flex min-w-0 items-center gap-1.5">
          <span>{selected.label}</span>
          {selected.count !== undefined && <small className="text-[10px] font-normal opacity-55">({selected.count})</small>}
        </span>
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
              <span className="flex min-w-0 items-center gap-1.5">
                <span>{option.label}</span>
                {option.count !== undefined && <small className="text-[10px] font-normal opacity-55">({option.count})</small>}
              </span>
              {option.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PreRegistersManager() {
  const { isAdmin, loadingAuth } = useAuth();
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
  const [createError, setCreateError] = useState("");
  const [createdInvite, setCreatedInvite] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [expandedInviteId, setExpandedInviteId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false); 
  const [editTarget, setEditTarget] = useState(null);
  const [listError, setListError] = useState("");
  const [regeneratingId, setRegeneratingId] = useState("");
  const [passwordResetTarget, setPasswordResetTarget] = useState(null);
  const [passwordResetResult, setPasswordResetResult] = useState(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState("");

  const countedTypeOptions = useMemo(() => typeFilterOptions.map((option) => ({
    ...option,
    count: option.value === "all" ? preRegisters.length : preRegisters.filter(
      (invite) => (invite.role || invite.type || "member") === option.value,
    ).length,
  })), [preRegisters]);

  const countedStatusOptions = useMemo(() => statusFilterOptions.map((option) => ({
    ...option,
    count: option.value === "all" ? preRegisters.length : preRegisters.filter(
      (invite) => option.value === "claimed" ? Boolean(invite.claimed) : !invite.claimed,
    ).length,
  })), [preRegisters]);

  async function loadPreRegisters() {
    setIsLoading(true);

    try {
      const data = await getPreRegisters();
      setPreRegisters(data);
      setListError("");
    } catch (error) {
      console.error(error);
      setListError("Não foi possível carregar os convites.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadPreRegisters();
  }, [isAdmin]);

  const filteredPreRegisters = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    const searchNumbers = onlyNumbers(search);

    return preRegisters.filter((item) => {
      const matchesSearch =
        !cleanSearch ||
        item.fullName?.toLowerCase().includes(cleanSearch) ||
        (Boolean(searchNumbers) && item.phone?.includes(searchNumbers));

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
    if (!editTarget || isSaving) return;
    try {
      setIsSaving(true);
      setCreateError("");
      await updatePreRegister(editTarget.id, { fullName, role, sex });
      await loadPreRegisters();
      setShowModal(false);
      setEditTarget(null);
    } catch (error) {
      console.error(error);
      setCreateError(error.message || "Não foi possível salvar as alterações.");
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

  async function handleCopyAccessCode(code = createdInvite?.temporaryCode, copyId = "created") {
    if (!code) return;

    const copyWithSelection = () => {
      const input = document.createElement("textarea");
      input.value = code;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      if (!copied) throw new Error("O navegador recusou a cópia.");
    };

    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          copyWithSelection();
        }
      } else {
        copyWithSelection();
      }
      setCodeCopied(copyId);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      console.error(error);
      setCodeCopied(false);
    }
  }

  async function handleRegenerateCode(item) {
    try {
      setRegeneratingId(item.id);
      setListError("");
      const code = await regenerateInviteAccessCode(item.id);
      setPreRegisters((current) => current.map((invite) => invite.id === item.id
        ? { ...invite, temporaryCode: code }
        : invite));
    } catch (error) {
      console.error(error);
      setListError("Não foi possível gerar o código de acesso.");
    } finally {
      setRegeneratingId("");
    }
  }

  async function handleResetPassword() {
    if (!passwordResetTarget || isResettingPassword) return;
    setIsResettingPassword(true);
    setPasswordResetError("");
    try {
      const result = await resetAccountPassword(passwordResetTarget.id);
      setPasswordResetResult(result);
      setPasswordResetTarget(null);
    } catch (resetError) {
      setPasswordResetError(resetError.message);
    } finally {
      setIsResettingPassword(false);
    }
  }

  if (loadingAuth) return <div className="flex min-h-screen items-center justify-center"><OrbitLoader /></div>;
  if (!isAdmin) return <Navigate to="/menu" replace />;

  return (
    <main className="admin-page h-[100dvh] overflow-hidden px-5 pb-[calc(90px+env(safe-area-inset-bottom))] pt-6 text-white" style={{ backgroundImage: `url(${generalBackground})` }}>
      <section className="mx-auto flex h-full min-h-0 w-full max-w-[420px] flex-col">
        <div className="mb-5 flex shrink-0 items-center justify-between">
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
            onClick={() => {
              setEditTarget(null);
              setFullName("");
              setPhone("");
              setRole("member");
              setSex("male");
              setCreateError("");
              setShowModal(true);
            }}
            className="admin-primary-action flex h-11 w-11 items-center justify-center active:scale-95"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="admin-panel relative z-20 mb-4 shrink-0 p-3">
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
            <IdvSelect value={typeFilter} onChange={setTypeFilter} options={countedTypeOptions} ariaLabel="Filtrar por tipo" />

            <IdvSelect value={statusFilter} onChange={setStatusFilter} options={countedStatusOptions} ariaLabel="Filtrar por status" />
          </div>
        </div>

        {listError && <p role="alert" className="mb-3 text-xs text-red-300">{listError}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-5 pr-1">
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
                    {!item.claimed && (
                      <div className="mx-4 mb-4 flex items-center justify-between gap-2 border border-[#ff713f]/25 bg-black/20 p-3">
                        {item.temporaryCode ? (
                          <>
                            <div>
                              <p className="text-[10px] text-white/45">Código de acesso</p>
                              <p className="text-xl text-[#ff8a4c]">{item.temporaryCode}</p>
                            </div>
                            <button type="button" onClick={() => handleCopyAccessCode(item.temporaryCode, item.id)} className="profile-modal-close flex h-10 w-10 items-center justify-center" aria-label="Copiar código" title="Copiar código">
                              {codeCopied === item.id ? <Check size={17} /> : <Copy size={17} />}
                            </button>
                          </>
                        ) : (
                          <div className="w-full">
                          <p className="mb-2 text-[10px] text-white/45">O código antigo não pode ser recuperado. Gerar um novo substitui o anterior.</p>
                          <button type="button" disabled={Boolean(regeneratingId)} onClick={() => handleRegenerateCode(item)} className="admin-primary-action flex min-h-10 w-full items-center justify-center gap-2 px-3 text-xs disabled:opacity-50">
                            {regeneratingId === item.id ? "Gerando..." : "Gerar novo código"}
                          </button>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="mx-4 mb-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="admin-delete-action flex h-10 items-center justify-center gap-2 text-xs"
                    >
                      <Trash2 size={16} />
                      excluir convite
                    </button>
                    <button type="button" onClick={() => {
                      setEditTarget(item);
                      setFullName(item.fullName || "");
                      setPhone(item.phone || "");
                      setRole(item.role || item.type || "member");
                      setSex(item.sex || "male");
                      setCreateError("");
                      setShowModal(true);
                    }} className="admin-primary-action flex h-10 items-center justify-center gap-2 text-xs">
                      <Pencil size={16} /> editar
                    </button>
                    </div>
                    {item.claimed && item.userId && (
                      <button type="button" onClick={() => { setPasswordResetError(""); setPasswordResetTarget(item); }} className="register-outline-action mx-4 mb-4 flex h-10 w-[calc(100%_-_2rem)] items-center justify-center gap-2 text-xs"><KeyRound size={16} /> redefinir senha</button>
                    )}
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
        </div>
      </section>

      {showModal && !editTarget && (
        <InviteCreateModal
          onClose={() => setShowModal(false)}
          onCreated={async (invite) => {
            setShowModal(false);
            setCreatedInvite(invite);
            await loadPreRegisters();
          }}
        />
      )}

      {showModal && editTarget && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-5 pb-5 backdrop-blur-sm">
          <form
            onSubmit={handleCreatePreRegister}
            className="profile-edit-modal w-full max-w-[420px] p-5"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-idv-title text-2xl">{editTarget ? "Editar convite" : "Novo convite"}</h2>

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
                disabled={isSaving}
                required
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nome completo"
                className="admin-input h-12 px-4 text-sm text-white outline-none placeholder:text-white/30"
              />

              <input
                value={phone}
                disabled={Boolean(editTarget)}
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
                {editTarget ? <Check size={18} /> : <UserPlus size={18} />}
                {isSaving ? "Salvando..." : editTarget ? "Salvar" : "Adicionar"}
              </button>

              {createError && (
                <p className="border-l-2 border-[#ff5964] bg-[#ff5964]/10 px-3 py-2 text-xs font-bold text-[#ff9da4]" role="alert">
                  {createError}
                </p>
              )}
            </div>
          </form>
        </div>
      )}

      {createdInvite && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 px-5 pb-5 backdrop-blur-sm">
          <div className="profile-edit-modal w-full max-w-[420px] p-5 text-center">
            <p className="text-sm text-slate-400">Código de primeiro acesso</p>
            <p className="mt-3 text-4xl text-[#ff713f]">
              {createdInvite.temporaryCode}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Envie este código para {createdInvite.fullName}. Ele ficará disponível nos detalhes do convite enquanto estiver pendente.
            </p>
            <button
              type="button"
              onClick={() => handleCopyAccessCode()}
              className="admin-primary-action mt-5 flex h-12 w-full items-center justify-center gap-2 text-sm"
            >
              {codeCopied === "created" ? <Check size={17} /> : <Copy size={17} />}
              {codeCopied === "created" ? "Código copiado" : "Copiar código"}
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

      {passwordResetTarget && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 px-5 py-5 backdrop-blur-sm">
          <div className="profile-edit-modal w-full max-w-[420px] p-5">
            <header className="flex items-start justify-between gap-3">
              <h2 className="font-idv-title text-2xl">Redefinir senha?</h2>
              <button type="button" disabled={isResettingPassword} onClick={() => setPasswordResetTarget(null)} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Fechar"><X size={17} /></button>
            </header>
            <p className="mt-4 text-sm leading-relaxed text-white/55">A senha atual de {passwordResetTarget.fullName} deixará de funcionar. A pessoa receberá uma senha temporária e precisará escolher uma nova ao entrar.</p>
            {passwordResetError && <p role="alert" className="mt-4 text-sm text-red-300">{passwordResetError}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={isResettingPassword} onClick={() => setPasswordResetTarget(null)} className="register-outline-action h-11 text-sm">cancelar</button>
              <button type="button" disabled={isResettingPassword} onClick={handleResetPassword} className="admin-primary-action flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-45"><KeyRound size={16} />{isResettingPassword ? "Redefinindo..." : "Redefinir"}</button>
            </div>
          </div>
        </div>
      )}

      {passwordResetResult && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 px-5 py-5 backdrop-blur-sm">
          <div className="profile-edit-modal w-full max-w-[420px] p-5 text-center">
            <header className="flex items-center justify-between gap-3">
              <h2 className="font-idv-title text-2xl">Senha temporária</h2>
              <button type="button" onClick={() => setPasswordResetResult(null)} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Fechar"><X size={17} /></button>
            </header>
            <p className="mt-5 font-mono text-3xl text-[#ff8a4c]">{passwordResetResult.temporaryPassword}</p>
            <p className="mt-3 text-sm leading-relaxed text-white/55">Envie no privado para {passwordResetResult.fullName}. Esta senha não será exibida novamente.</p>
            <button type="button" onClick={() => handleCopyAccessCode(passwordResetResult.temporaryPassword, "password-reset")} className="admin-primary-action mt-5 flex h-12 w-full items-center justify-center gap-2 text-sm">{codeCopied === "password-reset" ? <Check size={17} /> : <Copy size={17} />}{codeCopied === "password-reset" ? "Senha copiada" : "Copiar senha"}</button>
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
