// #38: data de "quando acaba" como um quadradinho de calendário (mês em cima, dia grande), fácil de bater o olho.
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function whenText(days: number): string {
  return days <= 0 ? "Acaba hoje" : days === 1 ? "Acaba amanhã" : `Acaba em ${days} dias`;
}

export function DateChip({ date, days, sub, compact }: { date: Date; days: number; sub?: string; compact?: boolean }) {
  const tone = days <= 1 ? "danger" : days <= 5 ? "warn" : "calm";
  return (
    <span className={`datechip ${tone}${compact ? " compact" : ""}`} aria-label={`${whenText(days)}, ${date.toLocaleDateString("pt-BR")}`}>
      <span className="dc-cal" aria-hidden="true">
        <span className="dc-mon">{MONTHS[date.getMonth()]}</span>
        <b className="dc-day">{date.getDate()}</b>
      </span>
      <span className="dc-txt">
        <b>{whenText(days)}</b>
        {sub === "" ? null : <small>{sub ?? WEEK[date.getDay()]}</small>}
      </span>
    </span>
  );
}
