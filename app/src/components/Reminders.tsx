// Experimento "Hora de repor": peças usadas pelos 5 fluxos.
// ReminderSheet = as 2 perguntas (quanto usa, quanto tem); ReminderOffer = cartão "Quer que a gente avise?";
// AddReminderSheet = adicionar à mão (fluxo 5).
import { useMemo, useState } from "react";
import type { Product } from "../contracts/types";
import { PRODUCTS } from "../services/mock/catalogData";
import { canRemind, countable, defaultReminder, endDate, fmtShort, isHealth, usageLine, withUsage, type Reminder, type ReminderSource } from "../services/reminders";
import { useApp } from "../state/app";
import { BottomSheet } from "./BottomSheet";
import { Icon } from "./Icon";
import { ProductImage } from "./ProductImage";

export const CONSENT_TEXT = "Guardamos só o produto e quanto você usa, neste aparelho, para avisar antes de acabar. Não usamos para propaganda. Você pode apagar quando quiser.";

/** As 2 perguntas, já preenchidas. Para produto por ml/g, uma só: quanto tempo dura. */
export function ReminderSheet({ product, initial, onSave, onClose, saveLabel }: {
  product: Product; initial: Reminder; onSave: (r: Reminder) => void; onClose: () => void; saveLabel: string;
}) {
  const { reminderConsentAt } = useApp();
  const [perDay, setPerDay] = useState(initial.perDay ?? 1);
  const [units, setUnits] = useState(initial.units ?? product.size.value);
  const [days, setDays] = useState(initial.days);
  const r = countable(product) ? withUsage(initial, perDay, units) : withUsage(initial, undefined, undefined, days);
  return (
    <BottomSheet title="Avisar quando acabar" onClose={onClose}>
      <div className="rem-prod">
        <ProductImage product={product} size={48} />
        <span className="grow"><b>{product.name}</b><small>{product.size.value} {product.size.unit === "un" ? "unidades" : product.size.unit}</small></span>
      </div>
      {countable(product) ? (
        <>
          <span className="section-title">Quanto você usa?</span>
          <div className="chips">
            {[1, 2, 3].map((n) => <button key={n} className={`chip${perDay === n ? " on" : ""}`} aria-pressed={perDay === n} onClick={() => setPerDay(n)}>{n} por dia</button>)}
          </div>
          <span className="section-title">Quanto ainda tem?</span>
          <div className="chips">
            <button className={`chip${units === product.size.value ? " on" : ""}`} aria-pressed={units === product.size.value} onClick={() => setUnits(product.size.value)}>A caixa inteira ({product.size.value})</button>
            <label className="chip rem-units">
              Outra: <input type="number" min={1} max={999} value={units} onChange={(e) => setUnits(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} aria-label="Quantas unidades ainda tem" />
            </label>
          </div>
        </>
      ) : (
        <>
          <span className="section-title">Quanto tempo costuma durar?</span>
          <div className="chips">
            {[15, 30, 45, 60].map((d) => <button key={d} className={`chip${days === d ? " on" : ""}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d} dias</button>)}
          </div>
        </>
      )}
      <div className="rem-end"><Icon name="clock" size={18} /> Acaba por volta de <b>{fmtShort(endDate(r))}</b> · avisamos 5 dias antes</div>
      {!reminderConsentAt ? <p className="rem-consent"><Icon name="lock" size={14} /> {CONSENT_TEXT}</p> : null}
      <button className="btn primary block" onClick={() => onSave(r)}><Icon name="bell" size={20} /> {saveLabel}</button>
    </BottomSheet>
  );
}

/** Cartão "Quer que a gente avise quando acabar?" com os itens que fazem sentido repor (fluxos 2, 3 e 4). */
export function ReminderOffer({ products, source, boughtBefore, onSkip, title = "Quer que a gente avise quando acabar?" }: {
  products: Product[]; source: ReminderSource; boughtBefore?: Map<string, string>; onSkip?: () => void; title?: string;
}) {
  const { dispatch, reminders, remindIntent, reminderConsentAt } = useApp();
  const eligible = useMemo(() => {
    const seen = new Set(reminders.map((r) => r.productId));
    const list = products.filter((p, i) => canRemind(p) && !seen.has(p.id) && products.findIndex((q) => q.id === p.id) === i);
    // fluxo 4: o que já foi comprado antes vem primeiro (sinal forte de uso contínuo)
    return boughtBefore ? [...list].sort((a, b) => Number(boughtBefore.has(b.id)) - Number(boughtBefore.has(a.id))) : list;
  }, [products, reminders, boughtBefore]);
  const [settings, setSettings] = useState<Record<string, Reminder>>(() => Object.fromEntries(eligible.map((p) => [p.id, defaultReminder(p, source)])));
  // remédio nunca vem marcado (dado de saúde); o que a pessoa marcou na página do produto vem
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(eligible.map((p) => [p.id, remindIntent.includes(p.id) && !isHealth(p)])));
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [done, setDone] = useState(0);

  if (done) {
    return (
      <section className="rem-offer done" aria-live="polite">
        <span className="rem-ok"><Icon name="checkCircle" size={22} /></span>
        <span className="grow"><b>{done === 1 ? "Aviso ligado" : `${done} avisos ligados`}</b><small>Avisamos 5 dias antes de acabar. Veja e ajuste em Meus medicamentos.</small></span>
      </section>
    );
  }
  if (!eligible.length) return null;
  const shown = all ? eligible : eligible.slice(0, 3);
  const n = eligible.filter((p) => checked[p.id]).length;
  const activate = () => {
    const list = eligible.filter((p) => checked[p.id]).map((p) => settings[p.id] ?? defaultReminder(p, source));
    dispatch({ type: "remAdd", reminders: list });
    setDone(list.length);
  };
  return (
    <section className="rem-offer" aria-label="Avisar quando acabar">
      <div className="rem-head"><span className="rem-bell"><Icon name="bell" size={20} /></span><b>{title}</b></div>
      {shown.map((p) => {
        const r = settings[p.id] ?? defaultReminder(p, source);
        const before = boughtBefore?.get(p.id);
        return (
          <div key={p.id} className="rem-item">
            <input type="checkbox" checked={!!checked[p.id]} onChange={(e) => setChecked({ ...checked, [p.id]: e.target.checked })} aria-label={`Avisar quando acabar: ${p.name}`} />
            <ProductImage product={p} size={44} />
            <span className="grow">
              <b>{p.name}</b>
              {before ? <span className="rem-again"><Icon name="repeat" size={12} /> Você já comprou em {before}</span> : null}
              <small>{usageLine(r)} · <button className="link plain" onClick={() => setEditing(p)}>ajustar</button></small>
            </span>
          </div>
        );
      })}
      {eligible.length > 3 && !all ? <button className="link plain rem-more" onClick={() => setAll(true)}>Ver mais {eligible.length - 3}</button> : null}
      {!reminderConsentAt ? <p className="rem-consent"><Icon name="lock" size={14} /> {CONSENT_TEXT}</p> : null}
      <div className="rem-actions">
        <button className="btn primary" disabled={!n} onClick={activate}><Icon name="bell" size={18} /> {n > 1 ? `Ativar ${n} avisos` : "Ativar aviso"}</button>
        {onSkip ? <button className="btn outline" onClick={onSkip}>Agora não</button> : null}
      </div>
      {editing ? (
        <ReminderSheet product={editing} initial={settings[editing.id] ?? defaultReminder(editing, source)} saveLabel="Usar estes dados" onClose={() => setEditing(null)}
          onSave={(r) => { setSettings({ ...settings, [editing.id]: r }); setChecked({ ...checked, [editing.id]: true }); setEditing(null); }} />
      ) : null}
    </section>
  );
}

/** Fluxo 5: adicionar à mão. Busca só entre o que faz sentido repor, depois as 2 perguntas. */
export function AddReminderSheet({ onClose }: { onClose: () => void }) {
  const { dispatch, reminders } = useApp();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Product | null>(null);
  const has = new Set(reminders.map((r) => r.productId));
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const list = q.trim().length < 2 ? [] : PRODUCTS.filter((p) => canRemind(p) && !has.has(p.id) && norm(p.name + " " + p.brand).includes(norm(q.trim()))).slice(0, 8);
  if (pick) {
    return <ReminderSheet product={pick} initial={defaultReminder(pick, 5)} saveLabel="Ativar aviso" onClose={onClose}
      onSave={(r) => { dispatch({ type: "remAdd", reminders: [r] }); onClose(); }} />;
  }
  return (
    <BottomSheet title="Adicionar item" onClose={onClose}>
      <div className="searchfield">
        <Icon name="search" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome do remédio, vitamina ou produto" aria-label="Buscar item para avisar" />
      </div>
      {q.trim().length < 2 ? <p className="sheet-text">Digite pelo menos 2 letras. Aparecem só remédios de uso contínuo, suplementos e produtos que acabam.</p> : null}
      {q.trim().length >= 2 && !list.length ? <p className="sheet-text">Nada encontrado. Remédio de uso pontual (antibiótico, analgésico) não entra em aviso de reposição.</p> : null}
      {list.map((p) => (
        <button key={p.id} className="opt" onClick={() => setPick(p)}>
          <ProductImage product={p} size={44} />
          <span className="info"><b>{p.name}</b><small>{p.brand} · {p.size.value} {p.size.unit}</small></span>
          <Icon name="chevron" size={18} />
        </button>
      ))}
    </BottomSheet>
  );
}
