"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import showToast from "@/components/ui/toast";

interface FutureBill {
  id?: number;
  name: string;
  amount?: number;
  reminderDate?: string;
  notifyDaysBefore?: number;
  notes?: string;
  priority?: string;
}

const BRL = (v = 0) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function FutureBillsManager() {
  const [items, setItems] = useState<FutureBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FutureBill | null>(null);
  const [showDelete, setShowDelete] = useState<FutureBill | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/future-bills`);
    if (res.ok) {
      setItems(await res.json());
    } else {
      setItems([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function update(index: number, patch: Partial<FutureBill>) {
    setItems((prev) => prev.map((it, i) => i === index ? { ...it, ...patch } : it));
  }

  function openNew() {
    setEditing({ name: "", amount: 0, reminderDate: undefined, notifyDaysBefore: 3 });
    setShowModal(true);
  }

  function openEdit(it: FutureBill) {
    setEditing(it);
    setShowModal(true);
  }

  async function submitModal(payload: FutureBill) {
    setSaving(true);
    if (payload.id) {
      await fetch(`/api/future-bills`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch(`/api/future-bills`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setSaving(false);
    setShowModal(false);
    setEditing(null);
    fetchData();
  }

  function confirmDelete(it: FutureBill) {
    setShowDelete(it);
  }

  async function doDelete(it: FutureBill) {
    if (!it.id) return;
    await fetch(`/api/future-bills?id=${it.id}`, { method: "DELETE" });
    setShowDelete(null);
    fetchData();
  }

  if (loading) return <div className="card p-4">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black">Contas futuras</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={openNew}
            className="px-3 py-2 rounded-md"
            style={{ background: "#389671", color: "#fff" }}
          >
            Adicionar
          </button>
          <button
            onClick={() => editing && submitModal(editing)}
            disabled={saving}
            className="px-3 py-2 rounded-md"
            style={{ background: "#1c2b22", color: "#8dcdb0" }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
      <div className="card p-4">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "#4a6b58" }}>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Valor</th>
              <th className="text-left p-2">Lembrete</th>
              <th className="text-left p-2">Notificar (dias)</th>
              <th className="text-left p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.id}
                className="border-t"
                style={{ borderColor: "#2a3d31" }}
              >
                <td className="p-2" style={{ color: "#f0f9f4" }}>
                  {it.name}
                </td>
                <td className="p-2" style={{ color: "#5ab28d" }}>
                  {BRL(it.amount)}
                </td>
                <td className="p-2" style={{ color: "#4a6b58" }}>
                  {it.reminderDate
                    ? format(parseISO(it.reminderDate), "dd/MM/yyyy")
                    : "(sem data)"}
                </td>
                <td
                  className="p-2"
                  style={{ color: "#4a6b58" }}
                >{`${it.notifyDaysBefore ?? 3} antes`}</td>
                <td className="p-2">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => openEdit(it)}
                      className="px-3 py-1 rounded-md"
                      style={{ background: "#1c2b22", color: "#8dcdb0" }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => confirmDelete(it)}
                      className="px-3 py-1 rounded-md"
                      style={{ background: "#2a2a2a", color: "#f87171" }}
                    >
                      Excluir
                    </button>
                    <button
                      onClick={async () => {
                          const date = it.reminderDate
                            ? parseISO(it.reminderDate)
                            : new Date();
                        const payload: any = {
                          name: it.name,
                          amount: it.amount || 0,
                          month: date.getMonth() + 1,
                          year: date.getFullYear(),
                          dueDay: it.reminderDate ? date.getDate() : null,
                          notes: it.notes || null,
                          installment: null,
                          isPaid: false,
                          category: null,
                        };
                        const res = await fetch(`/api/bills`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });
                        if (res.ok) {
                          if (it.id)
                            await fetch(`/api/future-bills`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: it.id,
                                notified: true,
                              }),
                            });
                          fetchData();
                          showToast("Adicionado ao radar de contas e marcado como notificado.");
                        } else showToast("Erro ao adicionar ao radar.");
                      }}
                      className="px-3 py-1 rounded-md"
                      style={{ background: "#389671", color: "#fff" }}
                    >
                      Radar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Add/Edit Modal (rendered via portal to avoid containment) */}
      {showModal && editing && (
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.7)" }}
              onClick={() => {
                setShowModal(false);
                setEditing(null);
              }}
            />
            <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-auto">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  const payload: FutureBill = {
                    id: editing.id,
                    name: String(fd.get("name") || "").trim(),
                    amount: parseFloat(String(fd.get("amount") || "0")) || 0,
                    reminderDate: fd.get("reminderDate")
                      ? String(fd.get("reminderDate"))
                      : undefined,
                    notifyDaysBefore:
                      parseInt(String(fd.get("notifyDaysBefore") || "3")) || 3,
                    notes: String(fd.get("notes") || "") || undefined,
                    priority: String(fd.get("priority") || "") || undefined,
                  };
                  await submitModal(payload);
                }}
                className="card p-6 w-full sm:max-w-lg space-y-4 max-h-[90vh] overflow-auto mt-10 sm:mt-0"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-black">
                  {editing.id ? "Editar conta futura" : "Nova conta futura"}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#8dcdb0" }}
                    >
                      Nome
                    </label>
                    <input
                      name="name"
                      defaultValue={editing.name}
                      required
                      className="input-base w-full"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#8dcdb0" }}
                    >
                      Valor
                    </label>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      defaultValue={editing.amount ?? 0}
                      className="input-base w-full"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#8dcdb0" }}
                    >
                      Lembrete
                    </label>
                    <input
                      name="reminderDate"
                      type="date"
                      defaultValue={editing.reminderDate ?? ""}
                      className="input-base w-full"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#8dcdb0" }}
                    >
                      Notificar (dias)
                    </label>
                    <input
                      name="notifyDaysBefore"
                      type="number"
                      defaultValue={editing.notifyDaysBefore ?? 3}
                      className="input-base w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#8dcdb0" }}
                    >
                      Observações
                    </label>
                    <textarea
                      name="notes"
                      defaultValue={editing.notes ?? ""}
                      className="input-base w-full"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditing(null);
                    }}
                    className="px-4 py-2 rounded-md"
                    style={{ background: "#1c2b22", color: "#8dcdb0" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-md"
                    style={{ background: "#389671", color: "#fff" }}
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            </div>
          </>,
          document.body,
        )
      )}

      {/* Delete confirm modal */}
      {showDelete &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.7)" }}
              onClick={() => setShowDelete(null)}
            />
            <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-auto">
              <div className="card p-6 w-full sm:max-w-md max-h-[80vh] overflow-auto mt-10 sm:mt-0">
                <h3 className="text-base font-black">Confirmar exclusão</h3>
                <p className="mt-2" style={{ color: "#4a6b58" }}>
                  Remover "{showDelete.name}" das contas futuras?
                </p>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowDelete(null)}
                    className="px-4 py-2 rounded-md"
                    style={{ background: "#1c2b22", color: "#8dcdb0" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => doDelete(showDelete)}
                    className="px-4 py-2 rounded-md"
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
