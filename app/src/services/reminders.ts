// Hora de repor: avisos de reposição que a própria pessoa liga (branch experimento/hora-de-repor).
// Só guarda o produto, quanto usa e quanto tem. Fica neste aparelho; nada vai para o motor nem para a LLM.
import type { Product } from "../contracts/types";
import type { ContinuousMedication } from "../persona";

export type ReminderSource = 1 | 2 | 3 | 4 | 5;

export interface Reminder {
  productId: string;
  /** Unidades por dia (comprimido, cápsula), de 1 a 6. Ausente em produto por ml/g, que usa só `days`. */
  perDay?: number;
  /** Quantas unidades a pessoa tinha em `startAt` (2 caixas de 60 = 120). */
  units?: number;
  /** Quantos dias dura a partir de `startAt`. */
  days: number;
  startAt: string;
  /** Caixas compradas (o tempo conta todas); a reposição sugere 1 (#32). */
  boughtBoxes: number;
  /** Por qual dos 5 fluxos o aviso entrou (para comparar). */
  source: ReminderSource;
}

export const DAY_MS = 86_400_000;
export const MAX_PER_DAY = 6;
/** #34: dias antes de acabar em que entra em "acabando" e sai o primeiro aviso. */
export const WARN_DAYS = 5;

/** #34: com reposição automática, 1 aviso (5 dias antes); sem ela, 5 dias antes, na véspera e no dia. */
export const alertSchedule = (auto: boolean): number[] => (auto ? [WARN_DAYS] : [WARN_DAYS, 1, 0]);
export function scheduleText(auto: boolean): string {
  return auto ? `Avisamos ${WARN_DAYS} dias antes e repomos para você` : `Avisamos ${WARN_DAYS} dias antes, na véspera e no dia`;
}

/** Remédio só se for de uso contínuo; antibiótico, analgésico e gripe ficam de fora (uso pontual). */
export function canRemind(p: Product): boolean {
  if (p.domain === "medicamento") return p.step === "reposicao";
  return true;   // suplemento, higiene e dermo acabam e se repõem
}

/** Remédio revela condição de saúde: pede consentimento à parte e nunca vem pré-marcado. */
export const isHealth = (p: Product) => p.domain === "medicamento";
/** #34: com receita não há reposição automática (a compra sempre passa pela receita). */
export const canAuto = (p: Product) => !p.rx;

export const countable = (p: Product) => p.size.unit === "un";

export function defaultReminder(p: Product, source: ReminderSource, boxes = 1, now = new Date()): Reminder {
  const b = Math.max(1, boxes);
  if (countable(p)) {
    const perDay = p.domain === "suplemento" && p.size.value >= 120 ? 2 : 1;
    const units = p.size.value * b;
    return { productId: p.id, perDay, units, days: Math.max(1, Math.floor(units / perDay)), startAt: now.toISOString(), boughtBoxes: b, source };
  }
  return { productId: p.id, days: 30 * b, startAt: now.toISOString(), boughtBoxes: b, source };
}

export function withUsage(r: Reminder, perDay: number | undefined, units: number | undefined, days?: number): Reminder {
  if (perDay && units != null) {
    const pd = Math.min(MAX_PER_DAY, Math.max(1, perDay));
    return { ...r, perDay: pd, units, days: Math.max(1, Math.floor(units / pd)) };
  }
  return { ...r, days: days ?? r.days };
}

/** Quantos dias UMA caixa dura (intervalo da reposição automática). */
export function boxDays(r: Reminder, p: Product): number {
  if (r.perDay) return Math.max(1, Math.floor(p.size.value / r.perDay));
  return Math.max(1, Math.round(r.days / Math.max(1, r.boughtBoxes)));
}

export const endDate = (r: Reminder) => new Date(Date.parse(r.startAt) + r.days * DAY_MS);
export const daysLeftOf = (r: Reminder, now = new Date()) => Math.max(0, Math.ceil((endDate(r).getTime() - now.getTime()) / DAY_MS));
export const fmtShort = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Frase curta de uso: "1 por dia · 2 caixas · acaba por volta de 08/12". */
export function usageLine(r: Reminder): string {
  const end = fmtShort(endDate(r));
  const boxes = r.boughtBoxes > 1 ? ` · ${r.boughtBoxes} caixas` : "";
  return r.perDay ? `${r.perDay} por dia${boxes} · acaba por volta de ${end}` : `dura uns ${r.days} dias${boxes} · acaba por volta de ${end}`;
}

const KIND: Record<Product["domain"], string> = { medicamento: "Uso contínuo", suplemento: "Suplemento", higiene: "Higiene", dermo: "Dermo" };

/** #33: o aviso vira um item da Hora de repor no mesmo formato de Pressão e Colesterol. */
export function toMed(r: Reminder, p: Product, now = new Date()): ContinuousMedication {
  const elapsed = Math.max(0, Math.floor((now.getTime() - Date.parse(r.startAt)) / DAY_MS));
  if (r.perDay && r.units != null) {
    return { productId: p.id, unitsPerDay: r.perDay, unitsLeft: Math.max(0, r.units - r.perDay * elapsed), packUnits: r.units, label: KIND[p.domain], userAdded: true };
  }
  return { productId: p.id, unitsPerDay: 1, unitsLeft: daysLeftOf(r, now), packUnits: r.days, label: KIND[p.domain], userAdded: true, unit: "dias" };
}
