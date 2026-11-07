import type { BillOwnership } from "@/lib/db/schema";

export interface Bill {
  id: number;
  name: string;
  amount: number;
  month: number;
  year: number;
  installment?: string;
  isPaid: boolean;
  dueDay?: number;
  category?: string;
  ownership: BillOwnership;
  notes?: string;
  barCode?: string | null;
  qrCode?: string | null;
  type?: "NORMAL" | "CARD";
  cardLast4?: string | null;
  cardNickname?: string | null;
  date?: string | null;
  attachments?: string | null;
  investmentId?: number | null;
}

export interface Salary {
  id: number;
  person: string;
  amount: number;
}

export interface Attachments {
  fatura?: { fileId: string; url: string; name: string };
  comprovante?: { fileId: string; url: string; name: string };
}

export interface CardTransaction {
  id: number;
  name: string;
  amount: number;
  installment?: string | null;
  category?: string | null;
  date?: string | null;
}

export interface FutureBill {
  id: number;
  name: string;
  amount?: number | null;
  reminderDate?: string | null;
  notifyDaysBefore?: number | null;
  notes?: string | null;
  priority?: string | null;
}

export type OwnershipFilter = BillOwnership | "all";
export type BillSort = "date" | "name";
