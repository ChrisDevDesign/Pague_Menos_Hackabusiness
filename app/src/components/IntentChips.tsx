import type { Intent } from "../contracts/types";
import { DERMO_GOALS, GOAL_LABEL } from "../contracts/types";
import { money } from "../services/format";
import { HScroll } from "./HScroll";
import { Icon } from "./Icon";

interface Props {
  intent: Intent;
  onEditSkin: () => void;
  onEditBudget: () => void;
  /** #21: o motor quer saber o tipo de pele; o chip ganha destaque em vez de um painel abaixo dos kits. */
  askSkin?: boolean;
  /** Uma linha só, com rolagem lateral (economiza altura acima dos kits). */
  oneLine?: boolean;
}

export function IntentChips({ intent, onEditSkin, onEditBudget, askSkin, oneLine }: Props) {
  const Row = oneLine ? HScroll : "div";
  return (
    <Row className={`chips${oneLine ? " one-line" : ""}`} aria-label="Como entendi o seu pedido">
      {intent.goals.map((g) => (
        <span key={g} className="chip goal">
          {GOAL_LABEL[g]}
        </span>
      ))}
      {intent.preferences.map((p) => (
        <span key={p} className="chip">
          {p}
        </span>
      ))}
      {(intent.exclude ?? []).map((x) => (
        <span key={`sem-${x}`} className="chip excl"><Icon name="close" size={13} /> sem {x}</span>
      ))}
      {intent.goals.some((g) => DERMO_GOALS.includes(g)) ? (
        <button className={`chip ${intent.skinType ? "" : askSkin ? "ask" : "missing"}`} onClick={onEditSkin}
          title={!intent.skinType && askSkin ? "Opcional: os kits já valem para qualquer tipo de pele" : undefined}>
          {intent.skinType ? `Pele ${intent.skinType}` : askSkin ? "Qual é a sua pele?" : "Tipo de pele"}
          <Icon name="chevron" size={14} />
        </button>
      ) : null}
      <button className={`chip ${intent.budgetCents == null ? "missing" : ""}`} onClick={onEditBudget}>
        {intent.budgetCents == null ? "Sem limite de valor" : `Até ${money(intent.budgetCents)}`}
        <Icon name="chevron" size={14} />
      </button>
    </Row>
  );
}
