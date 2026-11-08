// DADOS SIMULADOS. Os JSON em ../../mocks são gerados por tools/export_app_mock.py
// a partir do catálogo fictício. Em produção este arquivo deixa de existir: o app
// passa a chamar o serviço real (ver ../searchService.ts).
import productsJson from "../../mocks/products.mock.json";
import concernsJson from "../../mocks/concerns.mock.json";
import goalsJson from "../../mocks/goals.mock.json";
import interactionsJson from "../../mocks/interactions.mock.json";
import ingredientsJson from "../../mocks/ingredients.mock.json";
import warningsJson from "../../mocks/warnings.mock.json";
import storesJson from "../../mocks/stores.mock.json";
import commerceJson from "../../mocks/commerce.mock.json";
import categoriesJson from "../../mocks/categories.mock.json";
import unsplashJson from "../../mocks/unsplash.json";
import type {
  Category,
  DeliveryOption,
  GoalId,
  KitPreset,
  Product,
  ProductImage,
  Showcase,
  StepId,
  Store,
  WarningCode,
} from "../../contracts/types";

export interface GoalDef {
  id: GoalId;
  label: string;
  concerns: string[];
  requiredSteps: StepId[];
  optionalSteps: StepId[];
  synonyms: string[];
}

export interface Interaction {
  a: string;
  b: string;
  severity: "evitar" | "separar";
  reason: string;
}

export interface Ingredient {
  id: string;
  name: string;
  family: string;
  function: string;
  photosensitizing: boolean;
}

/** #41 (RDC 96/2008): remédio de prescrição nunca tem preço riscado, venha o dado como vier. */
export const noStrike = <T extends Product>(p: T): T => ((p.rx || p.domain === "medicamento") && p.listPriceCents !== p.priceCents ? { ...p, listPriceCents: p.priceCents } : p);
// ---------------------------------------------------------------------------
// #12 (auditoria 07/11): fotos do Unsplash, revisadas uma a uma (sem marca legível nem rosto).
// Cada produto recebe uma foto do grupo da sua embalagem; a cópia Pague Menos herda a do original.
// ---------------------------------------------------------------------------
type Photo = [group: string, id: string, file: string, by: string, user: string];
const PHOTOS = (unsplashJson as unknown as { fotos: Photo[] }).fotos;
const UTM = "utm_source=pague_menos_prototipo&utm_medium=referral";
export function unsplashImage([, id, file, by, user]: Photo, alt: string, w = 400, h = 400): ProductImage {
  return {
    src: `https://images.unsplash.com/${file}?auto=format&fit=crop&w=${w}&h=${h}&q=70`,
    alt,
    credit: { source: "Unsplash", photographer: by, photographerUrl: `https://unsplash.com/@${user}?${UTM}`, pageUrl: `https://unsplash.com/photos/${id}?${UTM}` },
  };
}
const LIQUID = new Set(["bottle", "dropper", "spray", "pump"]);
/** Grupo de foto pela área e pela embalagem do produto. */
export function photoGroup(p: Product): string[] {
  if (p.domain === "medicamento") return [p.form === "tube" ? "med_tube" : LIQUID.has(p.form) ? "med_liquid" : "med_box"];
  if (p.domain === "suplemento") return [p.form === "powder" ? "sup_powder" : "sup_caps"];
  if (p.domain === "higiene") {
    if (p.step === "higiene_oral") return ["hig_oral"];
    if (p.step === "desodorante") return ["hig_deo"];
    if (p.step === "higiene_cabelo" || LIQUID.has(p.form)) return ["hig_cabelo"];
    return ["hig_corpo"];
  }
  if (p.step === "protecao_solar" || p.step === "protecao_corporal") return ["dermo_solar", "dermo_tube"];
  const byForm: Record<string, string> = { tube: "dermo_tube", dropper: "dermo_dropper", jar: "dermo_jar", bottle: "dermo_bottle", pump: "dermo_bottle", spray: "dermo_bottle" };
  return [byForm[p.form] ?? "dermo_jar"];
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function withPhoto(p: Product): Product {
  if (p.images.length) return p;
  const groups = photoGroup(p);
  const pool = PHOTOS.filter((f) => groups.includes(f[0]));
  if (!pool.length) return p;
  return { ...p, images: [unsplashImage(pool[hash(p.id) % pool.length], `${p.productType}, foto ilustrativa`)] };
}

const BASE_PRODUCTS = (productsJson as unknown as Product[]).map(noStrike).map(withPhoto);

// ---------------------------------------------------------------------------
// #13 (auditoria 07/11): marca própria "Pague Menos". Cada item de dermo e higiene ganha uma cópia
// da marca própria (mesma fórmula e embalagem, preço menor, 5% de cashback). Os kits de dermo e higiene
// usam só esses itens (ver candidatesFor no composer); a busca e as categorias mostram os dois.
// ---------------------------------------------------------------------------
export const OWN_BRAND = "Pague Menos";
export const OWN_BRAND_CATEGORY = "pague-menos";
const OWN_DOMAINS = new Set<Product["domain"]>(["dermo", "higiene"]);
export const ownBrandId = (id: string) => `pm-${id}`;

/** Preço da marca própria: cerca de 12 a 18% abaixo, sempre terminando em ,90 e nunca igual ou acima do original. */
export function ownBrandPrice(cents: number): number {
  let p = Math.floor((cents * 0.85) / 100) * 100 + 90;
  while (p >= cents) p -= 100;
  return Math.max(p, 190);
}

function toOwnBrand(p: Product): Product {
  const priceCents = ownBrandPrice(p.priceCents);
  const listPriceCents = p.listPriceCents > p.priceCents ? Math.max(priceCents, ownBrandPrice(p.listPriceCents)) : priceCents;
  return {
    ...p,
    id: ownBrandId(p.id),
    brand: OWN_BRAND,
    priceCents,
    listPriceCents,
    cashbackPct: Math.max(p.cashbackPct, 5),
    priceTier: p.priceTier,
    categoryIds: [...p.categoryIds, OWN_BRAND_CATEGORY],
    description: `Marca própria Pague Menos, com a mesma proposta de ${p.name.toLowerCase()}. ${p.description.replaceAll(p.brand, OWN_BRAND)}`,
    ownBrand: true,
    ownBrandOf: p.id,
  };
}
export const OWN_BRAND_PRODUCTS = BASE_PRODUCTS.filter((p) => OWN_DOMAINS.has(p.domain)).map(toOwnBrand);
export const PRODUCTS = [...BASE_PRODUCTS, ...OWN_BRAND_PRODUCTS];
export const GOALS = goalsJson as unknown as GoalDef[];
export const INTERACTIONS = interactionsJson as unknown as Interaction[];
export const INGREDIENTS = ingredientsJson as unknown as Ingredient[];
export const WARNING_TEXT = warningsJson as unknown as Record<WarningCode, string>;

export const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

// Ecossistema (lojas fictícias, estoque por loja, frete, vitrines, categorias)
type StoreWithStock = Store & { stock: Record<string, number> };
const STORES_RAW = (storesJson as unknown as StoreWithStock[]).map((s) => {
  // a marca própria tem o mesmo estoque do item de origem em cada loja (#13)
  const stock = { ...s.stock };
  for (const p of OWN_BRAND_PRODUCTS) stock[p.id] = s.stock[p.ownBrandOf!] ?? 0;
  return { ...s, stock };
});
export const STORES: Store[] = STORES_RAW.map(({ stock: _stock, ...s }) => s);
export const STORE_BY_ID = new Map(STORES.map((s) => [s.id, s]));
export const STORE_STOCK = new Map(STORES_RAW.map((s) => [s.id, s.stock]));
const COMMERCE_RAW = commerceJson as unknown as {
  freeShippingFromCents: number;
  delivery: DeliveryOption[];
  showcases: Showcase[];
  kitPresets: KitPreset[];
  banners: ProductImage[];
  note: string;
};
/** #13: vitrine "Produtos Pague Menos" logo depois dos kits, com os mais vendidos da marca própria. */
const OWN_SHOWCASE: Showcase = {
  id: "pague-menos",
  title: "Produtos Pague Menos",
  type: "products",
  productIds: [...OWN_BRAND_PRODUCTS].sort((a, b) => a.salesRank - b.salesRank).slice(0, 12).map((p) => p.id),
};
const bannerPhoto = (g: string) => PHOTOS.find((f) => f[0] === g)!;
export const COMMERCE = {
  ...COMMERCE_RAW,
  // #12: banners da Home (kits, loja, protetor solar), na ordem em que a Home usa
  banners: COMMERCE_RAW.banners.length ? COMMERCE_RAW.banners : ["banner_kits", "banner_loja", "banner_solar"].map((g) => unsplashImage(bannerPhoto(g), "", 900, 500)),
  showcases: COMMERCE_RAW.showcases.flatMap((s) => (s.type === "kit_presets" ? [s, OWN_SHOWCASE] : [s])),
};
const OWN_BY_ORIGIN = new Map(OWN_BRAND_PRODUCTS.map((p) => [p.ownBrandOf!, p.id]));
export const CATEGORIES: Category[] = [
  // cada categoria mostra também a versão Pague Menos dos seus itens
  ...(categoriesJson as unknown as { nodes: Category[] }).nodes.map((c) => ({
    ...c,
    productIds: c.productIds.flatMap((id) => (OWN_BY_ORIGIN.has(id) ? [id, OWN_BY_ORIGIN.get(id)!] : [id])),
  })),
  { id: OWN_BRAND_CATEGORY, name: "Produtos Pague Menos", parent: null, productIds: OWN_BRAND_PRODUCTS.map((p) => p.id) },
];

/** Estoque de um produto: na loja (se houver loja) ou no centro de distribuição. */
export function stockAt(productId: string, storeId: string | null | undefined): number {
  if (!storeId) return PRODUCT_BY_ID.get(productId)?.stockQty ?? 0;
  return STORE_STOCK.get(storeId)?.[productId] ?? 0;
}

export function cashbackOf(p: Product): number {
  return Math.floor((p.priceCents * p.cashbackPct) / 100);
}
export const INGREDIENT_NAME = new Map(INGREDIENTS.map((i) => [i.id, i.name]));

export const CONCERN_LABEL: Record<string, string> = concernsJson;
