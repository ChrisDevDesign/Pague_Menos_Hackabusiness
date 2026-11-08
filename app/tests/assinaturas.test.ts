import { describe, expect, it } from "vitest";
import { createMockSearchService } from "../src/services/mock/mockSearchService";
import { DAY_MS, changeEvery, newSubscription, removeItem, sampleSubscription, setPaused, skipNext } from "../src/services/subscriptions";
import { initialState, reducer, type Order } from "../src/state/app";

// #9 (auditoria 07/11): assinaturas editáveis em Mais > Assinaturas
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);

async function kitAndIntent() {
  const res = await createMockSearchService().search({ query: "rotina anti idade", storeId: null, context: null });
  const kit = res.kits.find((k) => k.items.length >= 3) ?? res.kits[0];
  return { kit, intent: res.intent };
}

describe("assinaturas", () => {
  it("fechar pedido com kit assinado cria a assinatura, com o próximo envio em 30 dias", async () => {
    const { kit, intent } = await kitAndIntent();
    const order: Order = {
      id: "o1", createdAt: "2026-11-01T12:00:00.000Z", itemsCents: kit.totalCents, feeCents: 0, totalCents: kit.totalCents, cashbackCents: 0,
      mode: "agendada", storeName: null, payment: "Pix", status: "ok",
      lines: [{ key: "k1", type: "kit", kit, intent, qty: 1, everyDays: 30 }, { key: "k2", type: "kit", kit, intent, qty: 1, everyDays: 0 }],
    };
    const s = reducer({ ...initialState, lines: order.lines }, { type: "placeOrder", order });
    expect(s.subscriptions).toHaveLength(1);
    expect(days(order.createdAt, s.subscriptions[0].nextAt)).toBe(30);
    expect(s.subscriptions[0].status).toBe("ativa");
  });

  it("adiar de 30 para 60 dias empurra o próximo envio 30 dias, e voltar desfaz", async () => {
    const { kit, intent } = await kitAndIntent();
    const s = newSubscription({ id: "s1", kit, intent, everyDays: 30, createdAt: "2026-11-01T00:00:00.000Z", storeName: null });
    const s60 = changeEvery(s, 60);
    expect(s60.everyDays).toBe(60);
    expect(days(s.nextAt, s60.nextAt)).toBe(30);
    expect(changeEvery(s60, 30).nextAt).toBe(s.nextAt);
  });

  it("pular o próximo envio leva a data um ciclo para frente e conta o pulo", async () => {
    const { kit, intent } = await kitAndIntent();
    const s = newSubscription({ id: "s1", kit, intent, everyDays: 60, createdAt: "2026-11-01T00:00:00.000Z", storeName: null });
    const k = skipNext(s);
    expect(days(s.nextAt, k.nextAt)).toBe(60);
    expect(k.skips).toBe(1);
  });

  it("tirar item recalcula o preço com o desconto do novo número de itens; o último item não sai", async () => {
    const { kit, intent } = await kitAndIntent();
    const s = newSubscription({ id: "s1", kit, intent, everyDays: 30, createdAt: "2026-11-01T00:00:00.000Z", storeName: null });
    const out = s.kit.items[0].product;
    const r = removeItem(s, out.id)!;
    expect(r.kit.items.map((i) => i.product.id)).not.toContain(out.id);
    const sum = r.kit.items.reduce((t, i) => t + i.product.priceCents, 0);
    expect(r.kit.itemsTotalCents).toBe(sum);
    expect(r.kit.totalCents).toBe(sum - r.kit.discountCents);
    let one = r;
    while (one.kit.items.length > 1) one = removeItem(one, one.kit.items[0].product.id)!;
    expect(removeItem(one, one.kit.items[0].product.id)).toBeNull();
  });

  it("pausar, editar pelo reducer e cancelar de vez", async () => {
    const { kit, intent } = await kitAndIntent();
    const sub = newSubscription({ id: "s1", kit, intent, everyDays: 30, createdAt: "2026-11-01T00:00:00.000Z", storeName: null });
    let st = { ...initialState, subscriptions: [sub] };
    st = reducer(st, { type: "subSet", sub: setPaused(sub, true), toast: "pausada" });
    expect(st.subscriptions[0].status).toBe("pausada");
    expect(st.toast?.text).toBe("pausada");
    st = reducer(st, { type: "subCancel", id: "s1" });
    expect(st.subscriptions).toHaveLength(0);
  });

  it("a assinatura de exemplo tem pelo menos 2 itens de higiene e preço coerente", () => {
    const s = sampleSubscription(new Date("2026-11-07T12:00:00Z"))!;
    expect(s.kit.items.length).toBeGreaterThanOrEqual(2);
    expect(s.kit.items.every((i) => i.product.domain === "higiene")).toBe(true);
    expect(s.kit.totalCents).toBe(s.kit.itemsTotalCents - s.kit.discountCents);
    expect(Date.parse(s.nextAt)).toBeGreaterThan(Date.parse("2026-11-07T00:00:00Z"));
  });
});
