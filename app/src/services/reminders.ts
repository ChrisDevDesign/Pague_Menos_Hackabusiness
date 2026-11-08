// Experimento "Hora de repor": avisos de reposição que a própria pessoa liga (branch experimento/hora-de-repor).
// Só guarda o produto, quanto usa e quanto tem. Fica neste aparelho; nada vai para o motor nem para a LLM.
import type { Product } from "../contracts/types";

export type ReminderSource = 1 | 2 | 3 | 4 | 5;

export interface Reminder {
  productId: string;
  /** Unidades por dia (comprimido, cápsula). Ausente em produto por ml/g, que usa só `days`. */
  perDay?: number;
  /** Quantas unidades a pessoa tem agora. */
  units?: number;
  /** Quantos dias dura a partir de `startAt`. */
  days: number;
  startAt: string;
  /** Por qual dos 5 fluxos o aviso entrou (para comparar no experimento). */
  source: ReminderSource;
}

export const DAY_MS = 86_400_000;
/** Dias antes de acabar em que o aviso aparece. */
export const WARN_DAYS = 5;

/** Remédio só se for de uso contínuo; antibiótico, analgésico e gripe ficam de fora (uso pontual). */
export function canRemind(p: Product): boolean {
  if (p.domain === "medicamento") return p.step === "reposicao";
  return true;   // suplemento, higiene e dermo acabam e se repõem
}

/** Remédio revela condição de saúde: pede consentimento à parte e nunca vem pré-marcado. */
export const isHealth = (p: Product) => p.domain === "medicamento";

export const countable = (p: Product) => p.size.unit === "un";

export function defaultReminder(p: Product, source: ReminderSource, now = new Date()): Reminder {
  if (countable(p)) {
    const perDay = p.domain === "suplemento" && p.size.value >= 120 ? 2 : 1;
    return { productId: p.id, perDay, units: p.size.value, days: Math.max(1, Math.floor(p.size.value / perDay)), startAt: now.toISOString(), source };
  }
  return { productId: p.id, days: 30, startAt: now.toISOString(), source };
}

export function withUsage(r: Reminder, perDay: number | undefined, units: number | undefined, days?: number): Reminder {
  if (perDay && units != null) return { ...r, perDay, units, days: Math.max(1, Math.floor(units / perDay)) };
  return { ...r, days: days ?? r.days };
}

export const endDate = (r: Reminder) => new Date(Date.parse(r.startAt) + r.days * DAY_MS);
export const daysLeftOf = (r: Reminder, now = new Date()) => Math.max(0, Math.ceil((endDate(r).getTime() - now.getTime()) / DAY_MS));
export const fmtShort = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Frase curta de uso: "1 por dia · acaba por volta de 08/12". */
export function usageLine(r: Reminder): string {
  const end = fmtShort(endDate(r));
  return r.perDay ? `${r.perDay} por dia · acaba por volta de ${end}` : `dura uns ${r.days} dias · acaba por volta de ${end}`;
}
