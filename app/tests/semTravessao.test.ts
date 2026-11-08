import { describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";
import { PRODUCTS, STORES } from "../src/services/mock/catalogData";
import { noDash } from "../src/services/searchService";

// #20 (auditoria 07/11): nenhum travessão no app (dava cara de texto gerado)
const DASH = "\u2014";
const SOURCES = import.meta.glob("../src/**/*.{ts,tsx,json,css}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("sem travessão", () => {
  it("nenhum arquivo do app nem o título da página tem travessão", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
    const hits = Object.entries(SOURCES).filter(([, text]) => text.includes(DASH)).map(([f]) => f);
    expect(hits).toEqual([]);
    expect(indexHtml.includes(DASH)).toBe(false);
  });
  it("nomes de remédio no padrão de farmácia e endereços com hífen", () => {
    expect(PRODUCTS.some((p) => p.name.includes(DASH) || p.description.includes(DASH))).toBe(false);
    expect(PRODUCTS.find((p) => p.name.startsWith("Tensivalol potássico 50 mg (genérico)"))!.name).toBe("Tensivalol potássico 50 mg (genérico), 30 comprimidos");
    expect(STORES.every((s) => !s.address.includes(DASH))).toBe(true);
  });
  it("resposta do motor GraphRAG (catálogo antigo) chega sem travessão", () => {
    expect(noDash(`Dipirona 1 g ${DASH} 10 comprimidos`)).toBe("Dipirona 1 g, 10 comprimidos");
  });
});
