import { Trash2, X } from "lucide-react";

export default function ConfirmDeleteModal({
  title = "Excluir item",
  description = "Essa ação não poderá ser desfeita.",
  confirmText = "Excluir",
  cancelText = "Cancelar",
  isLoading = false,
  onConfirm,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 px-5 pb-5 backdrop-blur-sm">
      <div className="profile-edit-modal w-full max-w-[420px] p-5 text-white">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="admin-delete-icon flex h-11 w-11 shrink-0 items-center justify-center text-[#ff765c]">
              <Trash2 size={20} />
            </div>

            <div>
              <h2 className="font-idv-title text-2xl">{title}</h2>
              <p className="mt-1 text-sm text-slate-400">{description}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center text-white/70 disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="register-outline-action h-11 text-sm font-bold active:scale-[0.98] disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="admin-delete-action flex h-11 items-center justify-center gap-2 text-sm active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? "Excluindo..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
