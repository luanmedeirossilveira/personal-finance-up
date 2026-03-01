import { useState } from "react";
import { Attachments, Bill } from "./BillsManager";
import { Copy, FileText, MoreHorizontal, Pencil, Receipt, Trash2, X } from "lucide-react";

export default function BillsMobileActions({
  bill,
  att,
  onEdit,
  onDelete,
  onUpload,
  onDeleteAttachment,
}: Readonly<{
  bill: Bill;
  att: Attachments;
  onEdit: () => void;
  onDelete: () => void;
  onUpload: (id: number, type: "fatura" | "comprovante", file?: File) => void;
  onDeleteAttachment: (id: number, type: "fatura" | "comprovante") => void;
}>) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg"
        style={{ color: "#4a6b58" }}
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 z-50 mt-1 w-48 rounded-xl overflow-hidden shadow-xl"
            style={{ background: "#1c2b22", border: "1px solid #2a3d31" }}
          >
            {/* Editar */}
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="flex items-center gap-2 w-full px-4 py-3 text-sm text-left hover:bg-white/5"
              style={{ color: "#f0f9f4" }}
            >
              <Pencil size={14} /> Editar
            </button>

            {/* Fatura */}
            {att.fatura ? (
              <>
                <a
                  href={att.fatura.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-white/5"
                  style={{ color: "#5ab28d" }}
                  onClick={() => setOpen(false)}
                >
                  <FileText size={14} /> Ver fatura
                </a>
                <button
                  onClick={() => { setOpen(false); onDeleteAttachment(bill.id, "fatura"); }}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-left hover:bg-white/5"
                  style={{ color: "#4a6b58" }}
                >
                  <X size={14} /> Remover fatura
                </button>
              </>
            ) : (
              <label className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-white/5 cursor-pointer" style={{ color: "#f0f9f4" }}>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => { setOpen(false); onUpload(bill.id, "fatura", e.target.files?.[0]); }} />
                <FileText size={14} /> Anexar fatura
              </label>
            )}

            {/* Comprovante */}
            {att.comprovante ? (
              <>
                <a
                  href={att.comprovante.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-white/5"
                  style={{ color: "#5ab28d" }}
                  onClick={() => setOpen(false)}
                >
                  <Receipt size={14} /> Ver comprovante
                </a>
                <button
                  onClick={() => { setOpen(false); onDeleteAttachment(bill.id, "comprovante"); }}
                  className="flex items-center gap-2 w-full px-4 py-3 text-sm text-left hover:bg-white/5"
                  style={{ color: "#4a6b58" }}
                >
                  <X size={14} /> Remover comprovante
                </button>
              </>
            ) : (
              <label className="flex items-center gap-2 w-full px-4 py-3 text-sm hover:bg-white/5 cursor-pointer" style={{ color: "#f0f9f4" }}>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => { setOpen(false); onUpload(bill.id, "comprovante", e.target.files?.[0]); }} />
                <Receipt size={14} /> Anexar comprovante
              </label>
            )}

            {/* Código de barras */}
            {bill.barCode && (
              <button
                onClick={() => { setOpen(false); navigator.clipboard.writeText(bill.barCode!); }}
                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-left hover:bg-white/5"
                style={{ color: "#f0f9f4" }}
              >
                <Copy size={14} /> Copiar código de barras
              </button>
            )}

            {/* Divider + Deletar */}
            <div style={{ borderTop: "1px solid #2a3d31" }} />
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex items-center gap-2 w-full px-4 py-3 text-sm text-left hover:bg-red-500/10"
              style={{ color: "#ef4444" }}
            >
              <Trash2 size={14} /> Remover conta
            </button>
          </div>
        </>
      )}
    </div>
  );
}