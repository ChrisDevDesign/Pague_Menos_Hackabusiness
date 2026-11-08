import { describe, expect, it } from "vitest";
import { prefOk } from "../src/services/mock/composer";
import { PRODUCTS } from "../src/services/mock/catalogData";
import { createMockSearchService } from "../src/services/mock/mockSearchService";

// #49 (auditoria 08/11): "sem fragrância" não pode travar o kit por causa de escova, pente ou fio dental
const run = (query: string, context: Parameters<ReturnType<typeof createMockSearchService>["search"]>[0]["context"] = null) =>
  createMockSearchService().search({ query, storeId: null, context });

describe("preferências com escopo", () => {
  it("sem fragrância não vale para escova e creme dental; sem alumínio só vale para desodorante", () => {
    const of = (t: string) => PRODUCTS.find((p) => p.productType === t && !p.claims.includes("sem fragrância"))!;
    expect(prefOk(of("escova de dente"), "sem fragrância")).toBe(true);
    expect(prefOk(of("creme dental"), "sem fragrância")).toBe(true);
    expect(prefOk(of("shampoo"), "sem fragrância")).toBe(false);
    expect(prefOk(of("shampoo"), "sem alumínio")).toBe(true);
  });

  it("kit de higiene e depois 'sem fragrância' continua montando kit", async () => {
    const r1 = await run("kit de higiene");
    const r2 = await run("sem fragrância", r1.context);
    expect(r2.intent.preferences).toContain("sem fragrância");
    expect(r2.kits.length).toBeGreaterThan(0);
    for (const k of r2.kits) for (const i of k.items) expect(prefOk(i.product, "sem fragrância")).toBe(true);
  });

  it("'tira o que tem perfume' no meio da conversa vira sem fragrância e mantém o kit de higiene", async () => {
    const r1 = await run("kit de higiene");
    const r2 = await run("tira o que tem perfume", r1.context);
    expect(r2.intent.primaryGoal).toBe("higiene_premium");
    expect(r2.intent.preferences).toContain("sem fragrância");
    expect(r2.kits.length).toBeGreaterThan(0);
  });
});
