import { describe, expect, it } from "vitest";
import { PRODUCT_BY_ID } from "../src/services/mock/catalogData";
import { prefOk } from "../src/services/mock/composer";
import { createMockSearchService } from "../src/services/mock/mockSearchService";
import { attention } from "../src/services/urgency";

// #50 a #59 (auditoria 08/11): achados da varredura de bugs, no motor simulado (mesmas frases do motor GraphRAG)
const svc = createMockSearchService();
const run = (query: string, context: Parameters<typeof svc.search>[0]["context"] = null) => svc.search({ query, storeId: null, context });
const CORE: Record<string, string[]> = { higiene_corpo: ["sabonete", "gel de banho", "óleo de banho"], higiene_cabelo: ["shampoo", "condicionador"], higiene_oral: ["creme dental"] };

describe("achados da varredura", () => {
  it("#50: kit de higiene leva sabonete, shampoo e creme dental", async () => {
    const r = await run("kit de higiene pra viagem");
    expect(r.kits.length).toBe(3);
    for (const k of r.kits) for (const i of k.items) if (CORE[i.step]) expect(CORE[i.step].some((t) => i.product.productType.toLowerCase().startsWith(t)), i.product.name).toBe(true);
  });

  it("#51: 'tira o protetor' ajusta o kit sem trocar de objetivo", async () => {
    let r = await run("kit de skin care");
    const goal = r.intent.primaryGoal;
    r = await run("tira o protetor", r.context);
    expect(r.intent.primaryGoal).toBe(goal);
    expect(r.kits.length).toBeGreaterThan(0);
    for (const k of r.kits) expect(k.items.some((i) => i.step === "protecao_solar")).toBe(false);
    expect(r.reply).toMatch(/Pronto, ajustei/);   // #58
  });

  it("#52: febre persistente orienta e mantém a lista", async () => {
    const r = await run("estou com febre alta há 3 dias");
    expect(r.safety.decision).toBe("caution");
    expect(r.safety.category).toBe("procure_atendimento");
    expect(r.safety.message?.startsWith("Febre alta")).toBe(true);
    expect(r.reply).not.toMatch(/Febre alta/);   // sem repetir: a orientação fica no quadro de atenção
    expect(r.products.length).toBeGreaterThan(0);
    expect(attention("estou com febre")).toBeNull();
  });

  it("#53: alergia a ingrediente tira o ingrediente e mantém o kit", async () => {
    const r = await run("tenho alergia a niacinamida, quero kit pra acne");
    expect(r.intent.primaryGoal).toBe("acne");
    for (const k of r.kits) for (const i of k.items) expect(i.product.ingredients).not.toContain("niacinamida");
  });

  it("#54: remédio pra pressão lista os remédios de pressão", async () => {
    const r = await run("remédio pra pressão");
    expect(r.products.length).toBeGreaterThan(0);
    for (const p of r.products) expect(p.equivalence?.group.startsWith("tensivalol"), p.name).toBe(true);
  });

  it("#55: selo sem fragrância corrigido no catálogo", () => {
    for (const id of ["p243", "p279", "p281"]) expect(PRODUCT_BY_ID.get(id)!.claims).not.toContain("sem fragrância");
  });

  it("#56: 'sem açúcar' no kit de suplementos continua montando kit", async () => {
    let r = await run("kit de suplementos");
    r = await run("sem açúcar", r.context);
    expect(r.intent.preferences).toContain("sem açúcar");
    expect(r.kits.length).toBeGreaterThan(0);
    for (const k of r.kits) for (const i of k.items) expect(prefOk(i.product, "sem açúcar")).toBe(true);
  });

  it("#57: a lista depois do ajuste fica nas etapas do objetivo", async () => {
    let r = await run("kit para acne");
    r = await run("sem fragrância", r.context);
    for (const p of r.products) expect(p.coversSteps.some((s) => ["limpeza", "tratamento", "hidratacao", "protecao_solar", "preparo", "complemento"].includes(s)), p.name).toBe(true);
  });

  it("#58: cabelo cacheado vira lista de cabelo, como no motor", async () => {
    const r = await run("kit para cabelo cacheado");
    expect(r.kits).toEqual([]);
    for (const p of r.products) expect(p.coversSteps).toContain("higiene_cabelo");
  });

  it("#59: presente pergunta, vitamina c oferece o suplemento, pele ressecada fica na pele", async () => {
    const g = await run("presente pra minha mãe");
    expect(g.reply).toMatch(/presente/);
    expect(g.products).toEqual([]);
    expect((await run("vitamina c")).suggestions).toContain("Vitamina C suplemento");
    const s = await run("pele ressecada e repuxando depois do banho");
    expect(s.intent.skinType).toBe("seca");
    expect(s.intent.primaryGoal).not.toBe("higiene_premium");
  });
});
