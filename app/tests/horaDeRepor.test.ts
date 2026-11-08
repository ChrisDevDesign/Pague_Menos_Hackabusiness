import { describe, expect, it } from "vitest";
import { PRODUCT_BY_ID } from "../src/services/mock/catalogData";
import { alertSchedule, boxDays, canAuto, canRemind, defaultReminder, toMed, withUsage, MAX_PER_DAY } from "../src/services/reminders";
import { initialState, reducer, type Order } from "../src/state/app";

// #31 a #35 (auditoria 08/11): Hora de repor
const omega = PRODUCT_BY_ID.get("p107")!;      // 60 cápsulas, sem receita
const pressao = PRODUCT_BY_ID.get("p132")!;    // 30 comprimidos, com receita
const now = new Date("2026-11-08T12:00:00Z");

describe("Hora de repor", () => {
  it("2 caixas contam 120 unidades no tempo, mas a caixa (intervalo de reposição) segue sendo 60", () => {
    const r = defaultReminder(omega, 2, 2, now);
    expect(r.units).toBe(120);
    expect(r.days).toBe(120);
    expect(r.boughtBoxes).toBe(2);
    expect(boxDays(r, omega)).toBe(60);
    const r2 = withUsage(r, 2, 120);
    expect(r2.days).toBe(60);
    expect(boxDays(r2, omega)).toBe(30);
  });

  it("roleta vai de 1 a 6 por dia", () => {
    const r = defaultReminder(omega, 5, 1, now);
    expect(withUsage(r, 9, 60).perDay).toBe(MAX_PER_DAY);
  });

  it("com receita não tem reposição automática; avisos: automático só 5 dias antes, manual 5 dias, véspera e no dia", () => {
    expect(canAuto(pressao)).toBe(false);
    expect(canAuto(omega)).toBe(true);
    expect(alertSchedule(true)).toEqual([5]);
    expect(alertSchedule(false)).toEqual([5, 1, 0]);
    expect(canRemind(PRODUCT_BY_ID.get("p149")!)).toBe(false);   // ibuprofeno: uso pontual
  });

  it("o aviso vira item da Hora de repor contando o que já foi usado", () => {
    const r = defaultReminder(omega, 2, 1, new Date("2026-11-01T12:00:00Z"));
    const m = toMed(r, omega, now);
    expect(m.userAdded).toBe(true);
    expect(m.unitsLeft).toBe(53);
    expect(m.packUnits).toBe(60);
  });

  it("reposição automática comprada vira assinatura de reposição; remédio com receita não vira", () => {
    const order: Order = {
      id: "o9", createdAt: now.toISOString(), itemsCents: 0, feeCents: 0, totalCents: 0, cashbackCents: 0, mode: "retirada", storeName: "Loja", payment: "Pix", status: "ok",
      lines: [{ key: "p:p107", type: "product", product: omega, qty: 1, autoEvery: 60 }, { key: "p:p132", type: "product", product: pressao, qty: 1, autoEvery: 30 }],
    };
    const s = reducer({ ...initialState, subscriptions: [] }, { type: "placeOrder", order });
    expect(s.subscriptions).toHaveLength(1);
    expect(s.subscriptions[0].kind).toBe("reposicao");
    expect(s.subscriptions[0].everyDays).toBe(60);
    expect(s.subscriptions[0].kit.items[0].product.id).toBe("p107");
    expect(s.subscriptions[0].deliveriesLeft).toBe(1);   // sem escolha explícita: 2 entregas, esta é a 1ª
  });

  it("#44: escolheu 6 entregas, a assinatura fica com as 5 que faltam; com 1 entrega não vira assinatura", () => {
    const base = { id: "o10", createdAt: now.toISOString(), itemsCents: 0, feeCents: 0, totalCents: 0, cashbackCents: 0, mode: "retirada" as const, storeName: "Loja", payment: "Pix", status: "ok" };
    const six = reducer({ ...initialState, subscriptions: [] }, { type: "placeOrder", order: { ...base, lines: [{ key: "p:p107", type: "product", product: omega, qty: 1, autoEvery: 60, autoTimes: 6 }] } });
    expect(six.subscriptions[0].deliveriesLeft).toBe(5);
    const one = reducer({ ...initialState, subscriptions: [] }, { type: "placeOrder", order: { ...base, id: "o11", lines: [{ key: "p:p107", type: "product", product: omega, qty: 1, autoEvery: 60, autoTimes: 1 }] } });
    expect(one.subscriptions).toHaveLength(0);
  });
});
