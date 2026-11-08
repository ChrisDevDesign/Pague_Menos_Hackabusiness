import type { IconName } from "./components/Icon";

// Departamentos do menu do app (nomes do menu público). Sem `id` = fora do protótipo.
export const TOP_CATEGORIES: Array<{ label: string; icon: IconName; id?: string; short?: string }> = [
  { label: "Medicamentos e saúde", short: "Remédios", icon: "pill", id: "saude" },
  { label: "Dermo e beleza", short: "Dermo", icon: "lipstick", id: "dermo" },
  { label: "Mamães e bebês", short: "Bebês", icon: "stroller" },
  { label: "Vida saudável", short: "Vitaminas", icon: "dumbbell", id: "vida-saudavel" },
  { label: "Higiene pessoal", short: "Higiene", icon: "bottle", id: "higiene" },
  { label: "Conveniência", short: "Conveniência", icon: "bag" },
  { label: "Marcas exclusivas", short: "Pague Menos", icon: "cross", id: "pague-menos" },   // #13: Produtos Pague Menos
  { label: "Pet shop", short: "Pet", icon: "paw" },
];
