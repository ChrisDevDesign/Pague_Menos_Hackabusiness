// #44 e #48: antes de ligar a reposição automática, a pessoa escolhe quantas entregas quer (nunca fica sem fim).
// Usada em Meus medicamentos e, desde o #46, no pedido confirmado.
import { useState } from "react";
import type { Product } from "../contracts/types";
import { BottomSheet } from "./BottomSheet";
import { Icon } from "./Icon";
import { ProductImage } from "./ProductImage";

const DAY = 86_400_000;
const OPTIONS = [2, 3, 6, 12];
const fmt = (d: Date, year = false) => d.toLocaleDateString("pt-BR", year ? { day: "2-digit", month: "2-digit", year: "2-digit" } : { day: "2-digit", month: "short" }).replace(".", "");

export function AutoSheet({ product, every, current, firstIsThisOrder = true, onConfirm, onClose }: {
  product: Product; every: number; current?: number; firstIsThisOrder?: boolean; onConfirm: (times: number) => void; onClose: () => void;
}) {
  // #44: nada vem escolhido; a pessoa decide quantas entregas quer
  const [times, setTimes] = useState<number | null>(current ?? null);
  const at = (i: number) => new Date(Date.now() + i * every * DAY);
  const months = (n: number) => Math.max(1, Math.round((n * every) / 30));
  // linha do tempo: a 1ª, as 2 seguintes e a última (com reticências quando há mais no meio)
  const steps = !times ? [] : times <= 4 ? Array.from({ length: times }, (_, i) => i) : [0, 1, 2, times - 1];

  return (
    <BottomSheet title="Repor automaticamente" onClose={onClose}>
      <div className="as-prod">
        <ProductImage product={product} size={56} />
        <span className="grow">
          <b>{product.name}</b>
          <span className="as-every"><Icon name="repeat" size={13} /> 1 caixa a cada {every} dias</span>
        </span>
      </div>

      <span className="section-title as-title">Por quanto tempo?</span>
      <div className="as-opts" role="radiogroup" aria-label="Quantas entregas">
        {OPTIONS.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={times === n} className={`as-opt${times === n ? " on" : ""}`} onClick={() => setTimes(n)}>
            <span className="as-radio" aria-hidden="true" />
            <span className="as-n"><b>{n}</b><small>entregas</small></span>
            <span className="as-len">{months(n)} {months(n) === 1 ? "mês" : "meses"}</span>
            <span className="as-last">até {fmt(at(n - 1), true)}</span>
          </button>
        ))}
      </div>

      {times ? <div className="as-timeline" aria-label={`Entregas: ${steps.map((i) => (i === 0 && firstIsThisOrder ? "esta compra" : fmt(at(i)))).join(", ")}`}>
        {steps.map((i, k) => (
          <div key={i} className={`as-step${i === 0 ? " now" : ""}${k > 0 && steps[k - 1] !== i - 1 ? " gap" : ""}`}>
            <span className="as-dot" aria-hidden="true">{i === 0 ? <Icon name="check" size={12} /> : null}</span>
            <b>{i + 1}ª</b>
            <small>{i === 0 && firstIsThisOrder ? "esta compra" : fmt(at(i))}</small>
          </div>
        ))}
      </div> : <p className="as-hint">Escolha uma opção para ver as datas das entregas.</p>}

      <ul className="as-facts">
        <li><Icon name="bell" size={16} /> Avisamos 5 dias antes de cada entrega</li>
        <li><Icon name="skip" size={16} /> Pule ou cancele quando quiser em Mais &gt; Assinaturas</li>
        <li><Icon name="checkCircle" size={16} /> Depois da {times ? `${times}ª` : "última"}, para sozinha e perguntamos se quer continuar</li>
      </ul>

      <button className="btn primary block as-cta" disabled={!times} onClick={() => times && onConfirm(times)}>
        {times ? <><Icon name="repeat" size={20} /> Ligar por {times} entregas</> : "Escolha quantas entregas"}
      </button>
    </BottomSheet>
  );
}
