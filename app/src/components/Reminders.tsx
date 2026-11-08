// Hora de repor: peças usadas pelos 5 fluxos.
// WheelPicker = roleta vertical (#31); ReminderSheet = quanto usa, quantas caixas, quanto tem;
// ReminderOffer = cartão "Quer ser avisado antes de acabar?".
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Product } from "../contracts/types";
import { MAX_PER_DAY, canRemind, countable, defaultReminder, endDate, fmtShort, isHealth, usageLine, withUsage, type Reminder, type ReminderSource } from "../services/reminders";
import { PERSONA } from "../persona";
import { useApp } from "../state/app";
import { BottomSheet } from "./BottomSheet";
import { DateChip } from "./DateChip";
import { Icon } from "./Icon";
import { ProductImage } from "./ProductImage";

export const CONSENT_TEXT = "Guardamos só o produto e quanto você usa, neste aparelho, para avisar antes de acabar. Não usamos para propaganda. Você pode apagar quando quiser.";

const ROW = 44;

/** #31: roleta vertical, como a de calendário. Rola com dedo, roda do mouse ou setas; tocar num número também escolhe. */
export function WheelPicker({ value, min, max, onChange, label, suffix }: {
  value: number; min: number; max: number; onChange: (v: number) => void; label: string; suffix: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  useEffect(() => {
    ref.current?.scrollTo({ top: (value - min) * ROW, behavior: "smooth" });
  }, [value, min]);
  const onScroll = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const v = Math.min(max, Math.max(min, min + Math.round(el.scrollTop / ROW)));
      if (v !== value) onChange(v);
    }, 90);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp" && value > min) { e.preventDefault(); onChange(value - 1); }
    if (e.key === "ArrowDown" && value < max) { e.preventDefault(); onChange(value + 1); }
  };
  return (
    <div className="wheel" role="spinbutton" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      aria-valuetext={suffix(value)} onKeyDown={onKey}>
      <div className="wheel-band" aria-hidden="true" />
      <div className="wheel-scroll" ref={ref} onScroll={onScroll}>
        {values.map((v) => (
          <button key={v} type="button" tabIndex={-1} className={`wheel-item${v === value ? " on" : ""}`} onClick={() => onChange(v)}>
            {suffix(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** + e − compacto (caixas). */
export function Stepper({ value, min = 1, max, onChange, label }: { value: number; min?: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Menos: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}><Icon name="minus" size={18} /></button>
      <b aria-live="polite">{value}</b>
      <button type="button" aria-label={`Mais: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Icon name="plus" size={18} /></button>
    </span>
  );
}

/** Quanto usa (roleta 1 a 6), quantas caixas comprou e quanto ainda tem. Produto por ml/g: quanto tempo dura. */
export function ReminderSheet({ product, initial, onSave, onClose, saveLabel }: {
  product: Product; initial: Reminder; onSave: (r: Reminder) => void; onClose: () => void; saveLabel: string;
}) {
  const { reminderConsentAt } = useApp();
  const pack = product.size.value;
  const [perDay, setPerDay] = useState(initial.perDay ?? 1);
  const [boxes, setBoxes] = useState(initial.boughtBoxes);
  const [units, setUnits] = useState(initial.units ?? pack * initial.boughtBoxes);
  const [custom, setCustom] = useState(initial.units != null && initial.units !== pack * initial.boughtBoxes);
  const [days, setDays] = useState(Math.round(initial.days / Math.max(1, initial.boughtBoxes)));
  const total = custom ? units : pack * boxes;
  const r = countable(product)
    ? { ...withUsage(initial, perDay, total), boughtBoxes: boxes }
    : { ...withUsage(initial, undefined, undefined, days * boxes), boughtBoxes: boxes };
  return (
    <BottomSheet title="Avisar quando acabar" onClose={onClose}>
      <div className="rem-prod">
        <ProductImage product={product} size={48} />
        <span className="grow"><b>{product.name}</b><small>{pack} {product.size.unit === "un" ? "unidades por caixa" : `${product.size.unit} por embalagem`}</small></span>
      </div>
      <div className="rem-qgrid">
        {countable(product) ? (
          <div className="rem-q">
            <span className="section-title">Quanto você usa por dia?</span>
            <WheelPicker value={perDay} min={1} max={MAX_PER_DAY} onChange={setPerDay} label="Unidades por dia" suffix={(v) => `${v} por dia`} />
          </div>
        ) : (
          <div className="rem-q">
            <span className="section-title">Uma embalagem dura</span>
            <WheelPicker value={Math.min(6, Math.max(1, Math.round(days / 15)))} min={1} max={6} onChange={(v) => setDays(v * 15)} label="Quanto tempo dura" suffix={(v) => `${v * 15} dias`} />
          </div>
        )}
        <div className="rem-q">
          <span className="section-title">Quantas comprou?</span>
          <Stepper value={boxes} max={6} onChange={(v) => { setBoxes(v); setCustom(false); }} label="caixas compradas" />
          <small className="rem-hint">{boxes > 1 ? `Contamos o tempo de ${boxes} ${countable(product) ? "caixas" : "embalagens"}; na reposição sugerimos 1.` : "Na reposição sugerimos 1."}</small>
        </div>
      </div>
      {countable(product) ? (
        <>
          <span className="section-title">Quanto ainda tem?</span>
          <div className="chips">
            <button className={`chip${!custom ? " on" : ""}`} aria-pressed={!custom} onClick={() => setCustom(false)}>Tudo ({pack * boxes})</button>
            <label className={`chip rem-units${custom ? " on" : ""}`}>
              Outra: <input type="number" min={1} max={999} value={custom ? units : pack * boxes} onFocus={() => setCustom(true)}
                onChange={(e) => { setCustom(true); setUnits(Math.max(1, Math.min(999, Number(e.target.value) || 1))); }} aria-label="Quantas unidades ainda tem" />
            </label>
          </div>
        </>
      ) : null}
      <div className="rem-end">
        <DateChip date={endDate(r)} days={r.days} sub={`Aviso em ${fmtShort(new Date(endDate(r).getTime() - 5 * 86_400_000))}, 5 dias antes`} />
      </div>
      {!reminderConsentAt ? <p className="rem-consent"><Icon name="lock" size={14} /> {CONSENT_TEXT}</p> : null}
      <button className="btn primary block" onClick={() => onSave(r)}><Icon name="bell" size={20} /> {saveLabel}</button>
    </BottomSheet>
  );
}

/** Cartão "Quer ser avisado antes de acabar?" com os itens que fazem sentido repor (fluxos 2, 3 e 4).
 *  #37: a linha inteira marca; `onPending` informa o que está marcado, para ativar se a pessoa sair sem tocar em Ativar. */
export function ReminderOffer({ products, source, boughtBefore, boxesById, onSkip, onPending, title = "Quer ser avisado antes de acabar?", lead }: {
  products: Product[]; source: ReminderSource; boughtBefore?: Map<string, string>; boxesById?: Map<string, number>;
  onSkip?: () => void; onPending?: (list: Reminder[]) => void; title?: string; lead?: string;
}) {
  const { dispatch, reminders, remindIntent, reminderConsentAt } = useApp();
  const eligible = useMemo(() => {
    const seen = new Set([...reminders.map((r) => r.productId), ...PERSONA.continuousMedications.map((m) => m.productId)]);
    const list = products.filter((p, i) => canRemind(p) && !seen.has(p.id) && products.findIndex((q) => q.id === p.id) === i);
    return boughtBefore ? [...list].sort((a, b) => Number(boughtBefore.has(b.id)) - Number(boughtBefore.has(a.id))) : list;
    // só na montagem: a lista não muda enquanto a pessoa marca
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [settings, setSettings] = useState<Record<string, Reminder>>(() =>
    Object.fromEntries(eligible.map((p) => [p.id, defaultReminder(p, source, boxesById?.get(p.id) ?? 1)])));
  // remédio nunca vem marcado (dado de saúde); o que a pessoa marcou na página do produto vem
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(eligible.map((p) => [p.id, remindIntent.includes(p.id) && !isHealth(p)])));
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [done, setDone] = useState(0);
  const selected = eligible.filter((p) => checked[p.id]).map((p) => settings[p.id]);
  useEffect(() => { onPending?.(done ? [] : selected); });   // a cada mudança; o pai guarda o mais recente

  if (done) {
    return (
      <section className="rem-offer done" aria-live="polite">
        <span className="rem-ok"><Icon name="checkCircle" size={26} /></span>
        <span className="grow"><b>{done === 1 ? "Aviso ligado!" : `${done} avisos ligados!`}</b><small>Avisamos 5 dias antes de acabar. Ajuste quando quiser em Hora de repor.</small></span>
      </section>
    );
  }
  if (!eligible.length) return null;
  const shown = all ? eligible : eligible.slice(0, 3);
  const n = selected.length;
  const activate = () => { dispatch({ type: "remAdd", reminders: selected }); setDone(n); };
  return (
    <section className="rem-offer" aria-label="Avisar quando acabar">
      <div className="rem-head">
        <span className="rem-bell big"><Icon name="bell" size={24} /></span>
        <span className="grow"><b>{title}</b><small>{lead ?? "A gente lembra 5 dias antes e você repõe em 2 toques."}</small></span>
      </div>
      {shown.map((p) => {
        const r = settings[p.id];
        const before = boughtBefore?.get(p.id);
        return (
          <div key={p.id} className={`rem-item${checked[p.id] ? " sel" : ""}`}>
            <label className="rem-pick">
              <input type="checkbox" checked={!!checked[p.id]} onChange={(e) => setChecked({ ...checked, [p.id]: e.target.checked })} />
              <ProductImage product={p} size={48} />
              <span className="grow">
                <b>{p.name}</b>
                {before ? <span className="rem-again"><Icon name="repeat" size={12} /> Você já comprou em {before}</span> : null}
                <small>{usageLine(r)}</small>
              </span>
            </label>
            <button className="rem-adjust" onClick={() => setEditing(p)} aria-label={`Ajustar uso de ${p.name}`}><Icon name="settings" size={18} /> Ajustar</button>
          </div>
        );
      })}
      {eligible.length > 3 && !all ? <button className="btn-sm rem-more" onClick={() => setAll(true)}><Icon name="chevronDown" size={16} /> Ver mais {eligible.length - 3}</button> : null}
      {!reminderConsentAt ? <p className="rem-consent"><Icon name="lock" size={14} /> {CONSENT_TEXT}</p> : null}
      <div className="rem-actions">
        <button className="btn primary" disabled={!n} onClick={activate}><Icon name="bell" size={18} /> {n > 1 ? `Ativar ${n} avisos` : "Ativar aviso"}</button>
        {onSkip ? <button className="btn outline" onClick={onSkip}>Agora não</button> : null}
      </div>
      {editing ? (
        <ReminderSheet product={editing} initial={settings[editing.id]} saveLabel="Usar estes dados" onClose={() => setEditing(null)}
          onSave={(r) => { setSettings({ ...settings, [editing.id]: r }); setChecked({ ...checked, [editing.id]: true }); setEditing(null); }} />
      ) : null}
    </section>
  );
}
