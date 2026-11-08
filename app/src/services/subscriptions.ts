// Assinaturas de kit (#9 da auditoria de 07/11): registro próprio, criado quando o pedido com "Assinar" é fechado.
// Tudo é simulado e fica neste aparelho. As funções aqui são puras: o estado do app só guarda o resultado.
import type { Intent, Kit, KitItem, Product, StepId } from "../contracts/types";
import { kitCashback, kitPrice } from "../contracts/types";
import { PRODUCTS, cashbackOf } from "./mock/catalogData";

export type SubEvery = 30 | 60;
export type SubStatus = "ativa" | "pausada";

export interface Subscription {
  id: string;
  kit: Kit;
  intent: Intent;
  everyDays: SubEvery;
  /** Data do próximo envio (ISO). */
  nextAt: string;
  status: SubStatus;
  createdAt: string;
  storeName: string | null;
  /** Quantos envios a pessoa já pulou. */
  skips: number;
  /** Assinatura de demonstração da persona (não veio de pedido). */
  sample?: boolean;
}

export const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString();

/** Assinatura nova a partir de uma linha de kit assinada no pedido. */
export function newSubscription(p: { id: string; kit: Kit; intent: Intent; everyDays: SubEvery; createdAt: string; storeName: string | null }): Subscription {
  return { ...p, nextAt: addDays(p.createdAt, p.everyDays), status: "ativa", skips: 0 };
}

/** Muda a frequência (ex.: adiar de 30 para 60 dias). O próximo envio passa a contar a partir do último. */
export function changeEvery(s: Subscription, every: SubEvery): Subscription {
  if (every === s.everyDays) return s;
  return { ...s, everyDays: every, nextAt: addDays(s.nextAt, every - s.everyDays) };
}

/** Pula (cancela) só o próximo envio: o seguinte vem um ciclo depois. */
export function skipNext(s: Subscription): Subscription {
  return { ...s, nextAt: addDays(s.nextAt, s.everyDays), skips: s.skips + 1 };
}

export function setPaused(s: Subscription, paused: boolean): Subscription {
  return { ...s, status: paused ? "pausada" : "ativa" };
}

/** Recalcula preço, desconto, cashback e avisos do kit depois de mudar os itens. */
export function repriceKit(kit: Kit, items: KitItem[]): Kit {
  const price = kitPrice(items.reduce((t, i) => t + i.product.priceCents, 0), items.length);
  const ids = new Set(items.map((i) => i.product.id));
  return {
    ...kit,
    items,
    ...price,
    listTotalCents: items.reduce((t, i) => t + i.product.listPriceCents, 0),
    cashbackCents: kitCashback(items.reduce((t, i) => t + cashbackOf(i.product), 0), price.discountPct),
    alerts: kit.alerts.filter((a) => !a.productIds || a.productIds.every((id) => ids.has(id))),
  };
}

/** Tira um item. Devolve null se ele era o último (aí o caminho é cancelar). */
export function removeItem(s: Subscription, productId: string): Subscription | null {
  const items = s.kit.items.filter((i) => i.product.id !== productId);
  if (!items.length || items.length === s.kit.items.length) return items.length ? s : null;
  return { ...s, kit: repriceKit(s.kit, items) };
}

/** Troca o kit inteiro (depois de trocar um item pelo motor de busca). */
export function replaceKit(s: Subscription, kit: Kit): Subscription {
  return { ...s, kit };
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Kit de demonstração: higiene do dia a dia da persona, preferindo itens Pague Menos quando existem. */
export function sampleSubscription(now = new Date()): Subscription | null {
  const steps: StepId[] = ["higiene_corpo", "higiene_cabelo", "higiene_oral", "desodorante"];
  const pick = (step: StepId): Product | undefined => {
    const all = PRODUCTS.filter((p) => p.step === step && p.stockQty > 0);
    return all.find((p) => p.ownBrand) ?? all[0];
  };
  const items: KitItem[] = [];
  for (const step of steps) {
    const product = pick(step);
    if (product) items.push({ step, product, reason: "Item do seu kit de higiene do dia a dia." });
  }
  if (items.length < 2) return null;
  const base: Kit = {
    id: "k_assinatura_exemplo",
    tier: "essencial",
    title: "Higiene do dia a dia",
    goal: "higiene_premium",
    items: [],
    itemsTotalCents: 0,
    discountPct: 0,
    discountCents: 0,
    totalCents: 0,
    listTotalCents: 0,
    withinBudget: true,
    cashbackCents: 0,
    storeId: null,
    alerts: [],
    rationale: "Kit de higiene que a Renata recebe todo mês (exemplo do protótipo).",
  };
  const created = new Date(now.getTime() - 12 * DAY_MS).toISOString();
  const intent: Intent = { goals: ["higiene_premium"], primaryGoal: "higiene_premium", budgetCents: null, skinType: null, preferences: [], storeId: null, missing: [] };
  return { ...newSubscription({ id: "s_exemplo", kit: repriceKit(base, items), intent, everyDays: 30, createdAt: created, storeName: null }), sample: true };
}
