import { useState } from "react";
import { Bill } from "./BillsManager";
import { Check, CreditCard, Receipt } from "lucide-react";

const CATEGORIES = [
  "moradia",
  "transporte",
  "saude",
  "lazer",
  "investimentos",
  "alimentação",
  "outros",
];

export default function BillForm({
  bill,
  month,
  year,
  onClose,
  onSave,
}: Readonly<{
  bill: Bill | null;
  month: number;
  year: number;
  onClose: () => void;
  onSave: () => void;
}>) {
  const [type, setType] = useState<"NORMAL" | "CARD">(bill?.type === "CARD" ? "CARD" : "NORMAL");
  const [name, setName] = useState(bill?.name || "");
  const [amount, setAmount] = useState(bill?.amount?.toString() || "");
  const [installment, setInstallment] = useState(bill?.installment || "");
  const [isPaid, setIsPaid] = useState(bill?.isPaid || false);
  const [dueDay, setDueDay] = useState(bill?.dueDay?.toString() || "");
  const [category, setCategory] = useState(bill?.category || "");
  const [notes, setNotes] = useState(bill?.notes || "");
  const [barCode, setBarCode] = useState(bill?.barCode || "");
  const [qrCode, setQrCode] = useState(bill?.qrCode || "");
  const [cardLast4, setCardLast4] = useState(bill?.cardLast4 || "");
  const [cardNickname, setCardNickname] = useState(bill?.cardNickname || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload: any = {
      name: name.trim().toUpperCase(),
      amount: parseFloat(amount.replace(",", ".")),
      month,
      year,
      installment: installment || null,
      isPaid,
      dueDay: dueDay ? parseInt(dueDay) : null,
      category: type === "CARD" ? "cartão" : (category || null),
      notes: notes || null,
      barCode: type === "CARD" ? null : (barCode || null),
      qrCode: type === "CARD" ? null : (qrCode || null),
      type,
      cardLast4: type === "CARD" ? cardLast4 : null,
      cardNickname: type === "CARD" ? cardNickname : null,
    };

    if (bill) {
      await fetch(`/api/bills/${bill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    onSave();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex justify-center p-4 items-end sm:items-start">
        <form
          onSubmit={handleSubmit}
          className="card rounded-t-2xl sm:rounded-2xl p-6 space-y-4 w-full sm:max-w-md max-h-[90vh] overflow-auto mt-0 sm:mt-[20vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <h3
            className="text-base font-black"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {bill ? "Editar conta" : "Nova conta"}
          </h3>

          {/* Type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("NORMAL")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                type === "NORMAL" ? "ring-2 ring-offset-1" : ""
              }`}
              style={{
                background: type === "NORMAL" ? "#389671" : "#1c2b22",
                color: type === "NORMAL" ? "#fff" : "#8dcdb0",
                borderColor: "#2a3d31",
                ringColor: "#389671",
                ringOffsetColor: "#0f1a15",
              }}
            >
              <Receipt size={16} />
              Conta normal
            </button>
            <button
              type="button"
              onClick={() => setType("CARD")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                type === "CARD" ? "ring-2 ring-offset-1" : ""
              }`}
              style={{
                background: type === "CARD" ? "#389671" : "#1c2b22",
                color: type === "CARD" ? "#fff" : "#8dcdb0",
                borderColor: "#2a3d31",
                ringColor: "#389671",
                ringOffsetColor: "#0f1a15",
              }}
            >
              <CreditCard size={16} />
              Fatura cartão
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Card-specific fields */}
            {type === "CARD" && (
              <>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                    style={{ color: "#8dcdb0" }}
                  >
                    Últimos 4 dígitos
                  </label>
                  <input
                    value={cardLast4}
                    onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="input-base"
                    placeholder="1234"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                    style={{ color: "#8dcdb0" }}
                  >
                    Apelido
                  </label>
                  <input
                    value={cardNickname}
                    onChange={(e) => setCardNickname(e.target.value)}
                    className="input-base"
                    placeholder="Nubank Luan"
                  />
                </div>
              </>
            )}

            <div className={type === "CARD" ? "col-span-2" : "col-span-2"}>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "#8dcdb0" }}
              >
                {type === "CARD" ? "Nome da fatura *" : "Nome *"}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-base"
                placeholder={type === "CARD" ? "FATURA NUBANK ABR/2026" : "ALUGUEL"}
                required
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "#8dcdb0" }}
              >
                {type === "CARD" ? "Valor total *" : "Valor *"}
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-base"
                placeholder="440,00"
                required
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "#8dcdb0" }}
              >
                Vencimento (dia)
              </label>
              <input
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="input-base"
                placeholder="10"
                type="number"
                min="1"
                max="31"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "#8dcdb0" }}
              >
                Parcela
              </label>
              <input
                value={installment}
                onChange={(e) => setInstallment(e.target.value)}
                className="input-base"
                placeholder="SEMPRE ou 3/12"
              />
            </div>
            {type === "NORMAL" && (
              <div>
                <label
                  className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                  style={{ color: "#8dcdb0" }}
                >
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-base"
                >
                  <option value="">Selecionar...</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} style={{ background: "#1c2b22" }}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: "#8dcdb0" }}
              >
                Observações
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-base"
                placeholder="Notas opcionais..."
              />
            </div>
            {type === "NORMAL" && (
              <>
                <div className="col-span-2">
                  <label
                    className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                    style={{ color: "#8dcdb0" }}
                  >
                    Código de barras
                  </label>
                  <input
                    value={barCode}
                    onChange={(e) => setBarCode(e.target.value)}
                    className="input-base"
                    placeholder="Código de barras (opcional)"
                  />
                </div>
                <div className="col-span-2">
                  <label
                    className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                    style={{ color: "#8dcdb0" }}
                  >
                    QR Code
                  </label>
                  <input
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value)}
                    className="input-base"
                    placeholder="QR Code (opcional)"
                  />
                </div>
              </>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: isPaid ? "#389671" : "#2a3d31",
                background: isPaid ? "#389671" : "transparent",
              }}
              onClick={() => setIsPaid(!isPaid)}
            >
              {isPaid && <Check size={12} strokeWidth={3} color="#fff" />}
            </div>
            <span className="text-sm" style={{ color: "#8dcdb0" }}>
              Marcar como pago
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: "#1c2b22",
                color: "#8dcdb0",
                border: "1px solid #2a3d31",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "#389671", color: "#fff" }}
            >
              {saving ? "Salvando..." : bill ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
