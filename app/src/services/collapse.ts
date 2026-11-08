// #27 (auditoria 08/11): na mesma lista, o produto e a sua cópia Pague Menos têm o mesmo nome e pareciam repetidos.
// Fica um cartão só (o Pague Menos, mais barato), com o atalho para a outra marca.
import type { Product } from "../contracts/types";

export interface Collapsed {
  product: Product;
  /** O mesmo produto de outra marca, quando os dois estavam na lista. */
  alt?: Product;
}

export function collapseOwnBrand(list: Product[]): Collapsed[] {
  const ids = new Set(list.map((p) => p.id));
  const altOf = new Map<string, Product>();
  for (const p of list) if (p.ownBrand && p.ownBrandOf && ids.has(p.ownBrandOf)) altOf.set(p.id, list.find((q) => q.id === p.ownBrandOf)!);
  const hidden = new Set([...altOf.values()].map((p) => p.id));
  const out: Collapsed[] = [];
  for (const p of list) {
    if (hidden.has(p.id)) {
      // o original some, mas o lugar dele na ordem fica com a versão Pague Menos
      const own = list.find((q) => q.ownBrandOf === p.id)!;
      if (!out.some((c) => c.product.id === own.id)) out.push({ product: own, alt: p });
      continue;
    }
    if (altOf.has(p.id)) {
      if (!out.some((c) => c.product.id === p.id)) out.push({ product: p, alt: altOf.get(p.id) });
      continue;
    }
    out.push({ product: p });
  }
  return out;
}
