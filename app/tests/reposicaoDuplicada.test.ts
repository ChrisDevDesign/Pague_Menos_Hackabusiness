import { describe, expect, it } from "vitest";
import { OWN_BRAND_PRODUCTS, PRODUCT_BY_ID } from "../src/services/mock/catalogData";
import { defaultReminder, itemKey } from "../src/services/reminders";
import { initialState, reducer, type Order } from "../src/state/app";

// #46 e #47 (auditoria 08/11): repor automático no pedido confirmado, sem item duplicado em Meus medicamentos
const copia = OWN_BRAND_PRODUCTS.find((p) => !p.rx && p.domain === "dermo") ?? OWN_BRAND_PRODUCTS[0];
const original = PRODUCT_BY_ID.get(copia.ownBrandOf!)!;
const now = new Date("2026-11-08T12:00:00Z");

const order = (id: string, autoProduct?: typeof original): Order => ({
  id, createdAt: now.toISOString(), itemsCents: 0, feeCents: 0, totalCents: 0, cashbackCents: 0, mode: "retirada", storeName: "Loja", payment: "Pix", status: "ok",
  lines: autoProduct ? [{ key: `p:${autoProduct.id}`, type: "product", product: autoProduct, qty: 1, autoEvery: 30, autoTimes: 3 }] : [],
});

describe("Hora de repor sem duplicar", () => {
  it("original e cópia Pague Menos são o mesmo item; equivalentes de remédio também", () => {
    expect(copia.name).toBe(original.name);
    expect(itemKey(copia)).toBe(itemKey(original));
    expect(itemKey(PRODUCT_BY_ID.get("p132")!)).toBe(itemKey(PRODUCT_BY_ID.get("p134")!));   // Tensivalol genérico e similar
    expect(itemKey(PRODUCT_BY_ID.get("p132")!)).not.toBe(itemKey(PRODUCT_BY_ID.get("p136")!));
  });

  it("aviso da cópia substitui o do original e herda a reposição automática", () => {
    let s = reducer(initialState, { type: "remAdd", reminders: [defaultReminder(original, 2, 1, now)] });
    s = reducer(s, { type: "setRefillAuto", id: original.id, on: true, times: 6 });
    s = reducer(s, { type: "remAdd", reminders: [defaultReminder(copia, 2, 1, now)] });
    expect(s.reminders.map((r) => r.productId)).toEqual([copia.id]);
    expect(s.refillAuto[copia.id]).toBe(true);
    expect(s.refillAutoTimes[copia.id]).toBe(6);
    expect(s.refillAuto[original.id]).toBeUndefined();
  });

  it("equivalente de um remédio da persona não vira um segundo cartão", () => {
    const similar = PRODUCT_BY_ID.get("p134")!;   // Pressolan, mesmo grupo do Tensivalol da persona
    const s = reducer(initialState, { type: "remAdd", reminders: [defaultReminder(similar, 2, 1, now)] });
    expect(s.reminders).toEqual([]);
  });

  it("#46: ligar no pedido confirmado cria a assinatura com as entregas que faltam e liga a reposição", () => {
    const s = reducer(initialState, { type: "autoStart", items: [{ product: original, qty: 1, everyDays: 30, times: 3 }], orderId: "A", createdAt: now.toISOString(), storeName: "Loja" });
    const mine = s.subscriptions.filter((x) => x.kind === "reposicao");
    expect(mine).toHaveLength(1);
    expect(mine[0].deliveriesLeft).toBe(2);
    expect(s.refillAuto[original.id]).toBe(true);
    expect(s.refillAutoTimes[original.id]).toBe(3);
  });

  it("comprar de novo com reposição automática troca a assinatura antiga do mesmo item em vez de somar", () => {
    let s = reducer(initialState, { type: "autoStart", items: [{ product: original, qty: 1, everyDays: 30, times: 3 }], orderId: "A", createdAt: now.toISOString(), storeName: "Loja" });
    s = reducer({ ...s, lines: order("B", copia).lines }, { type: "placeOrder", order: order("B", copia) });
    const mine = s.subscriptions.filter((x) => x.kind === "reposicao");
    expect(mine).toHaveLength(1);
    expect(mine[0].kit.items[0].product.id).toBe(copia.id);
  });
});
