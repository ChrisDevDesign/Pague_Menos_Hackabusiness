import { describe, expect, it } from "vitest";
import { CATEGORIES, OWN_BRAND_PRODUCTS, PRODUCTS, PRODUCT_BY_ID, ownBrandPrice, stockAt, STORES } from "../src/services/mock/catalogData";
import { createMockSearchService } from "../src/services/mock/mockSearchService";

// #13 (auditoria 07/11): etiqueta "Produto Pague Menos" e kits só com itens da marca própria
const run = (query: string) => createMockSearchService().search({ query, storeId: null, context: null });

describe("Produto Pague Menos", () => {
  it("duplica todos os itens de dermo e higiene, e nenhum remédio ou suplemento", () => {
    const origin = PRODUCTS.filter((p) => !p.ownBrand && (p.domain === "dermo" || p.domain === "higiene"));
    expect(OWN_BRAND_PRODUCTS).toHaveLength(origin.length);
    expect(OWN_BRAND_PRODUCTS.every((p) => p.brand === "Pague Menos" && p.ownBrand && PRODUCT_BY_ID.get(p.ownBrandOf!))).toBe(true);
    expect(OWN_BRAND_PRODUCTS.some((p) => p.domain === "medicamento" || p.domain === "suplemento")).toBe(false);
  });

  it("é mais barata que o original, termina em ,90 e tem o mesmo estoque nas lojas", () => {
    for (const p of OWN_BRAND_PRODUCTS) {
      const o = PRODUCT_BY_ID.get(p.ownBrandOf!)!;
      expect(p.priceCents).toBeLessThan(o.priceCents);
      expect(p.priceCents % 100).toBe(90);
      for (const s of STORES) expect(stockAt(p.id, s.id)).toBe(stockAt(o.id, s.id));
    }
    expect(ownBrandPrice(2490)).toBe(2190);
    expect(ownBrandPrice(1990)).toBe(1690);
  });

  it("tem categoria própria e aparece nas categorias do item de origem", () => {
    const cat = CATEGORIES.find((c) => c.id === "pague-menos")!;
    expect(cat.productIds).toHaveLength(OWN_BRAND_PRODUCTS.length);
    const dermo = CATEGORIES.find((c) => c.id === "dermo")!;
    expect(dermo.productIds).toContain(OWN_BRAND_PRODUCTS.find((p) => p.domain === "dermo")!.id);
  });

  it.each([
    "rotina anti idade",
    "pele oleosa com acne",
    "protetor solar e manchas",
    "higiene premium: shampoo, creme dental e desodorante",
  ])("kits de \"%s\" saem só com itens Pague Menos", async (q) => {
    const r = await run(q);
    expect(r.kits.length).toBeGreaterThan(0);
    for (const k of r.kits) for (const i of k.items) expect(i.product.ownBrand, `${k.tier}: ${i.product.name} (${i.product.brand})`).toBe(true);
  });

  it("suplementos continuam com as marcas de sempre (não há marca própria)", async () => {
    const r = await run("kit de suplementos: ômega 3, colágeno e magnésio");
    expect(r.kits.length).toBeGreaterThan(0);
    expect(r.kits.flatMap((k) => k.items).some((i) => i.product.ownBrand)).toBe(false);
  });
});
