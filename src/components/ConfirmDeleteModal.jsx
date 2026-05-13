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
      <div className="w-full max-w-[420px] rounded-[1.8rem] border border-white/10 bg-[#13201c]/95 p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-3xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <Trash2 size={20} />
            </div>

            <div>
              <h2 className="text-lg font-black">{title}</h2>
              <p className="mt-1 text-sm text-slate-400">{description}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-11 rounded-full border border-white/10 bg-white/[0.04] text-sm font-bold text-slate-300 active:scale-[0.98] disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-red-500 text-sm font-black text-white active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? "Excluindo..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}