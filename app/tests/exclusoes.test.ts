import { describe, expect, it } from "vitest";
import { parseExclusions } from "../src/services/mock/exclusions";
import { createMockSearchService } from "../src/services/mock/mockSearchService";

// #24 e #25 (auditoria 08/11): o "sem" precisa tirar o item, não devolver o mesmo pedido
const run = (query: string, context: Parameters<ReturnType<typeof createMockSearchService>["search"]>[0]["context"] = null) =>
  createMockSearchService().search({ query, storeId: null, context });
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

describe("o que a pessoa pede para tirar", () => {
  it("lê tipo de produto, etapa, princípio ativo e ignora preferências", () => {
    expect(parseExclusions("me de kits de skin care sem gel de limpeza facial").types).toEqual(["gel de limpeza"]);
    expect(parseExclusions("kit de skin care sem limpeza").steps).toEqual(["limpeza"]);
    expect(parseExclusions("remedios para dor de cabeça sem ser dipirona").ingredients).toEqual(["dipirona"]);
    expect(parseExclusions("tenho alergia a dipirona").ingredients).toEqual(["dipirona"]);
    const pref = parseExclusions("kit sem fragrância e sem gastar muito");
    expect(pref.labels).toEqual([]);
  });

  it("#24: kit de skin care sem gel de limpeza não traz gel de limpeza, mas continua com etapa de limpeza", async () => {
    const r = await run("me de kits de skin care sem gel de limpeza facial");
    expect(r.intent.primaryGoal).toBe("skincare_basico");
    expect(r.kits.length).toBeGreaterThan(0);
    for (const k of r.kits) {
      expect(k.items.some((i) => fold(i.product.productType) === "gel de limpeza")).toBe(false);
      expect(k.items.some((i) => i.step === "limpeza")).toBe(true);
    }
    expect(r.products.some((p) => fold(p.productType) === "gel de limpeza")).toBe(false);
    expect(r.intent.exclude).toEqual(["gel de limpeza"]);
    expect(r.notes[0]).toMatch(/Sem gel de limpeza/);
  });

  it("#24: \"sem limpeza\" tira a etapa inteira do kit", async () => {
    const r = await run("kit de skin care sem limpeza");
    expect(r.kits.length).toBeGreaterThan(0);
    for (const k of r.kits) expect(k.items.some((i) => i.step === "limpeza")).toBe(false);
  });

  it("#25: remédio para dor de cabeça sem ser dipirona não mostra dipirona, nem em combinação", async () => {
    const r = await run("remedios para dor de cabeça sem ser dipirona");
    expect(r.intent.primaryGoal).toBe("dor_de_cabeca");
    expect(r.products.length).toBeGreaterThan(0);
    expect(r.products.some((p) => p.ingredients.includes("dipirona") || /dipirona/i.test(p.name))).toBe(false);
    expect(r.notes[0]).toMatch(/Sem dipirona/);
  });

  it("na conversa, \"tira a dipirona\" vale como ajuste da busca anterior", async () => {
    const first = await run("remédio para dor de cabeça");
    expect(first.products.some((p) => p.ingredients.includes("dipirona"))).toBe(true);
    const r = await run("tira a dipirona", first.context);
    expect(r.intent.primaryGoal).toBe("dor_de_cabeca");
    expect(r.products.some((p) => p.ingredients.includes("dipirona"))).toBe(false);
  });
});
