import { LogoMark } from "./Icon";

/** Selo "Produto Pague Menos" (#13): marca própria, preferida nos kits. */
export function OwnBrandTag({ small }: { small?: boolean }) {
  return (
    <span className={`own-tag${small ? " small" : ""}`} title="Marca própria Pague Menos">
      <LogoMark size={small ? 13 : 15} />
      Produto Pague Menos
    </span>
  );
}
