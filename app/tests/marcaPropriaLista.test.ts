import { describe, expect, it } from "vitest";
import { collapseOwnBrand } from "../src/services/collapse";
import { createMockSearchService } from "../src/services/mock/mockSearchService";

// #27 (auditoria 08/11): o original e a cópia Pague Menos viram um cartão só, com atalho para a outra marca
describe("lista sem nomes repetidos", () => {
  it("skin care: nenhum nome aparece duas vezes e cada par vira um cartão Pague Menos com a outra marca", async () => {
    const r = await createMockSearchService().search({ query: "skin care", storeId: null, context: null });
    const before = r.products.map((p) => p.name);
    expect(new Set(before).size).toBeLessThan(before.length);        // antes: havia repetidos
    const list = collapseOwnBrand(r.products);
    const names = list.map((c) => c.product.name);
    expect(new Set(names).size).toBe(names.length);
    const pair = list.find((c) => c.alt)!;
    expect(pair.product.ownBrand).toBe(true);
    expect(pair.alt!.id).toBe(pair.product.ownBrandOf);
  });
});
