// #24 e #25 (auditoria 08/11): entender o que a pessoa pede para TIRAR ("sem gel de limpeza", "sem ser dipirona").
// A palavra depois do "sem" é comparada com o catálogo, nesta ordem:
//   1. tipo de produto citado ("gel de limpeza")          -> sai só aquele tipo; a etapa continua com outro formato
//   2. etapa inteira ("limpeza", "protetor solar")         -> a etapa sai do kit
//   3. princípio ativo ou ingrediente ("dipirona")         -> sai todo produto que tem o ativo, inclusive combinações
//   4. parte do nome de produtos ou marca ("hidratante")   -> saem os produtos com isso no nome
// Preferências ("sem fragrância", "sem álcool") e o resto da frase ("sem gastar muito") não entram aqui.
// A mesma regra está no motor (graphrag/nlu.py, `negated_items`).
import type { Product, StepId } from "../../contracts/types";
import { INGREDIENTS, PRODUCTS } from "./catalogData";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const CUE = /\b(sem ser|sem|tirando|tira|tirar|retira|exceto|menos|nao quero|nada de|que nao seja|nao pode ser|alergia a|alergico a|alergica a)\s+/g;
const ARTICLE = /^(o|a|os|as|de|do|da|dos|das|um|uma|nenhum|nenhuma)\s+/;
const STOP = /\s(e|ou|mas|para|pra|com|ate|que|porque|pois|por|no|na|so)\s|[,.;!?]/;
/** "sem" que já é preferência do catálogo ou não é sobre produto. */
const SKIP = /^(fragrancia|perfume|alcool|oleo\b|parabeno|sulfato|gluten|lactose|acucar|gastar|pagar|frete|receita|demora|pressa|nada\b)/;

export const STEP_WORDS: Array<[string, StepId]> = [
  ["limpeza", "limpeza"], ["limpar", "limpeza"],
  ["hidratacao", "hidratacao"], ["hidratante", "hidratacao"],
  ["protetor solar", "protecao_solar"], ["protecao solar", "protecao_solar"], ["filtro solar", "protecao_solar"], ["protetor", "protecao_solar"],
  ["tonico", "preparo"], ["esfoliante", "preparo"], ["esfoliacao", "preparo"], ["mascara", "preparo"],
  ["serum", "tratamento"], ["tratamento", "tratamento"],
];

const TYPES = [...new Set(PRODUCTS.map((p) => fold(p.productType)))].sort((a, b) => b.length - a.length);
const ING = INGREDIENTS.map((i) => ({ id: i.id, name: fold(i.name) })).filter((i) => i.name.length >= 4);

export interface Exclusions {
  types: string[];
  steps: StepId[];
  ingredients: string[];
  names: string[];
  /** Como mostrar para a pessoa ("gel de limpeza", "dipirona"). */
  labels: string[];
  /** A frase sem os trechos "sem X" reconhecidos (para o "gel de limpeza" negado não virar pedido de limpeza). */
  stripped?: string;
}

export const NO_EXCLUSIONS: Exclusions = { types: [], steps: [], ingredients: [], names: [], labels: [] };

/** Lê os "sem X" de uma frase já normalizada (minúsculas, sem acento). */
export function parseExclusions(text: string): Exclusions {
  const q = ` ${fold(text)} `;
  const out: Exclusions = { types: [], steps: [], ingredients: [], names: [], labels: [] };
  const cut: Array<[number, number]> = [];
  const add = (k: "types" | "steps" | "ingredients" | "names", v: string, label: string) => {
    const list = out[k] as string[];
    if (!list.includes(v)) list.push(v);
    if (!out.labels.includes(label)) out.labels.push(label);
  };
  for (const m of q.matchAll(CUE)) {
    let rest = q.slice((m.index ?? 0) + m[0].length);
    const stop = rest.search(STOP);
    if (stop >= 0) rest = rest.slice(0, stop);
    let x = rest.trim().split(/\s+/).slice(0, 5).join(" ");
    while (ARTICLE.test(x)) x = x.replace(ARTICLE, "");
    if (x.length < 3 || SKIP.test(x)) continue;
    const before = out.labels.length;
    const span: [number, number] = [m.index ?? 0, (m.index ?? 0) + m[0].length + rest.indexOf(x) + x.length];
    const padded = ` ${x} `;
    const type = TYPES.find((t) => padded.includes(` ${t} `));
    if (type) { add("types", type, type); cut.push(span); continue; }
    const step = STEP_WORDS.find(([w]) => x === w || x.startsWith(`${w} `));
    if (step) { add("steps", step[1], step[0]); cut.push(span); continue; }
    const ing = ING.find((i) => i.name === x || padded.includes(` ${i.name} `) || i.name.startsWith(`${x} `));
    if (ing) { add("ingredients", ing.id, ing.name); cut.push(span); continue; }
    const types = TYPES.filter((t) => x.length >= 4 && t.includes(x));
    if (types.length) { for (const t of types) add("types", t, x); cut.push(span); continue; }
    if (x.length >= 4 && PRODUCTS.some((p) => fold(`${p.name} ${p.brand}`).includes(x))) add("names", x, x);
    if (out.labels.length > before) cut.push(span);
  }
  let stripped = q;
  for (const [a, b] of [...cut].sort((u, v) => v[0] - u[0])) stripped = stripped.slice(0, a) + " " + stripped.slice(b);
  out.stripped = stripped.replace(/\s+/g, " ").trim();
  return out;
}

export const hasExclusions = (e: Exclusions | undefined) => !!e && e.labels.length > 0;

export function isExcluded(p: Product, e: Exclusions | undefined): boolean {
  if (!e || !e.labels.length) return false;
  if (e.types.includes(fold(p.productType))) return true;
  if (e.ingredients.some((i) => p.ingredients.includes(i))) return true;
  const hay = fold(`${p.name} ${p.brand}`);
  return e.names.some((n) => hay.includes(n));
}

/** "gel de limpeza e dipirona" para as mensagens. */
/** Reconstrói as exclusões a partir dos rótulos guardados no Intent (contrato entre telas e conversa). */
export function exclusionsFromLabels(labels: string[] | undefined): Exclusions {
  if (!labels?.length) return NO_EXCLUSIONS;
  return parseExclusions(labels.map((l) => `sem ${l}`).join(", "));
}

export function exclusionText(e: Exclusions): string {
  const l = e.labels;
  return l.length <= 1 ? (l[0] ?? "") : `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`;
}
