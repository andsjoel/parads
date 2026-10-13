/* eslint-disable react/prop-types */
import { useState } from "react";
import { Check, ChevronDown, Mars, UserPlus, Venus, X } from "lucide-react";
import { createPreRegister } from "../../services/preRegisterService";
import { maskPhone, onlyNumbers } from "../../utils/phone";

const roles = [
  { value: "member", label: "Membro" },
  { value: "guest", label: "Convidado" },
  { value: "admin", label: "Admin" },
];

export default function InviteCreateModal({ initialName = "", initialRole = "member", guestOnly = false, onClose, onCreated }) {
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(initialRole);
  const [sex, setSex] = useState("male");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdInvite, setCreatedInvite] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (!fullName.trim() || onlyNumbers(phone).length !== 11) {
      setError("Informe o nome e um celular com DDD.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const invite = createdInvite || await createPreRegister({ fullName, phone: onlyNumbers(phone), role, sex });
      setCreatedInvite(invite);
      await onCreated(invite);
    } catch (creationError) {
      console.error(creationError);
      setError(creationError.code === "invite-already-exists" || creationError.code === "auth/email-already-in-use"
        ? "Esse celular já possui um cadastro. Procure a pessoa na busca."
        : "Não foi possível concluir. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-black/70 px-5 py-5 backdrop-blur-sm" onClick={() => !saving && onClose()}>
      <form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="profile-edit-modal w-full max-w-[420px] p-5 text-white">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-idv-title text-2xl">Novo convite</h2>
          <button type="button" disabled={saving} onClick={onClose} className="profile-modal-close flex h-10 w-10 items-center justify-center" aria-label="Fechar"><X size={18} /></button>
        </header>
        <div className="flex flex-col gap-3">
          <input aria-label="Nome completo" value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={saving || Boolean(createdInvite)} placeholder="Nome completo" className="admin-input h-12 px-4 text-sm outline-none placeholder:text-white/30" />
          <input aria-label="Celular com DDD" value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} disabled={saving || Boolean(createdInvite)} inputMode="tel" placeholder="61 9 9999-9999" className="admin-input h-12 px-4 text-sm outline-none placeholder:text-white/30" />
          <div className="admin-select admin-select--large relative">
            <button type="button" disabled={guestOnly || saving || Boolean(createdInvite)} onClick={() => setRoleMenuOpen((open) => !open)} className="admin-select-trigger" aria-label="Tipo de acesso" aria-haspopup="listbox" aria-expanded={roleMenuOpen}>
              {roles.find((option) => option.value === role)?.label}<ChevronDown size={16} />
            </button>
            {roleMenuOpen && <div className="admin-select-menu" role="listbox">{roles.map((option) => (
              <button key={option.value} type="button" role="option" aria-selected={role === option.value} onClick={() => { setRole(option.value); setRoleMenuOpen(false); }} className={`admin-select-option ${role === option.value ? "admin-select-option--selected" : ""}`}>
                {option.label}{role === option.value && <Check size={14} />}
              </button>
            ))}</div>}
          </div>
          <div className="relative grid h-12 grid-cols-2 rounded-md border border-white/10 bg-black/25 p-1" role="radiogroup" aria-label="Sexo">
            {[{ value: "male", label: "Homem", Icon: Mars }, { value: "female", label: "Mulher", Icon: Venus }].map(({ value, label, Icon }) => (
              <button key={value} type="button" disabled={saving || Boolean(createdInvite)} role="radio" aria-checked={sex === value} onClick={() => setSex(value)} className={`flex items-center justify-center gap-2 rounded-[3px] text-sm font-black ${sex === value ? value === "female" ? "bg-[#ff3299] text-[#1a0504]" : "bg-gradient-to-r from-[#ff3d2e] to-[#ff8a2e] text-[#1a0504]" : "text-[#9aa89f]"}`}>
                <Icon size={18} />{label}
              </button>
            ))}
          </div>
          {error && <p role="alert" className="border-l-2 border-[#ff5964] bg-[#ff5964]/10 px-3 py-2 text-xs text-[#ff9da4]">{error}</p>}
          <button type="submit" disabled={saving} className="admin-primary-action mt-2 flex h-12 items-center justify-center gap-2 text-sm disabled:opacity-50"><UserPlus size={18} />{saving ? "Salvando..." : createdInvite ? "Concluir" : "Adicionar"}</button>
        </div>
      </form>
    </div>
  );
}
