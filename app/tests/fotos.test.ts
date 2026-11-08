import { describe, expect, it } from "vitest";
import { COMMERCE, PRODUCTS, PRODUCT_BY_ID } from "../src/services/mock/catalogData";

// #7 e #12 (auditoria 07/11): fotos do Unsplash em todos os produtos e nos banners, com crédito
describe("fotos do Unsplash", () => {
  it("nenhum produto fica sem foto, e toda foto é do Unsplash com crédito do fotógrafo", () => {
    expect(PRODUCTS.filter((p) => !p.images.length)).toEqual([]);
    for (const p of PRODUCTS) {
      const i = p.images[0];
      expect(i.src).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?/);
      expect(i.credit.source).toBe("Unsplash");
      expect(i.credit.photographer.length).toBeGreaterThan(0);
      expect(i.credit.pageUrl).toMatch(/^https:\/\/unsplash\.com\/photos\/[\w-]+\?utm_source=/);
      expect(i.alt).toContain(p.productType);
    }
  });

  it("remédio usa foto de remédio, e a cópia Pague Menos usa a foto do original", () => {
    const med = PRODUCTS.filter((p) => p.domain === "medicamento").map((p) => p.images[0].src);
    const dermo = new Set(PRODUCTS.filter((p) => p.domain === "dermo").map((p) => p.images[0].src));
    expect(med.some((s) => dermo.has(s))).toBe(false);
    for (const p of PRODUCTS.filter((x) => x.ownBrand)) expect(p.images[0].src).toBe(PRODUCT_BY_ID.get(p.ownBrandOf!)!.images[0].src);
  });

  it("os 3 banners da Home têm foto", () => {
    expect(COMMERCE.banners).toHaveLength(3);
    expect(COMMERCE.banners.every((b) => b.src.startsWith("https://images.unsplash.com/"))).toBe(true);
  });
});
