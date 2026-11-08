// Meus medicamentos: REPOSIÇÃO do que a pessoa já usa (lista que fica no aparelho).
// Os dados (itens, quantidades, receita) ficam no aparelho; o motor só devolve equivalentes a partir de um id de produto.
import { useMemo, useRef, useState } from "react";
import { boxDays, canAuto, itemKeyOf, toMed } from "../services/reminders";
import { PRODUCT_BY_ID } from "../services/mock/catalogData";
import { Stepper } from "../components/Reminders";
import { AutoSheet } from "../components/AutoSheet";
import { DateChip } from "../components/DateChip";
import { TitleBar } from "../components/Bars";
import { Icon } from "../components/Icon";
import { ProductImage } from "../components/ProductImage";
import type { Product, SimilarsResponse, StoreAvailability } from "../contracts/types";
import { useNav, useServices } from "../nav";
import { DELIVERY_RANK, PERSONA, REFILL_RULES, daysLeft, needsRefill, runOutDate, type ContinuousMedication } from "../persona";
import { hasStockHere } from "../refillStock";
import { delta, money } from "../services/format";
import { RX_MAX_QTY, maxQty, useApp } from "../state/app";
import { useAsync } from "../useAsync";

const PRES: Record<string, string> = { referencia: "Referência", generico: "Genérico", similar: "Similar" };

export function Refill(_: { add?: boolean }) {
  const { commerce } = useServices();
  const { push } = useNav();
  const { store, storeId, dispatch, refillAuto, refillAutoTimes, rxAttached, consent, refillPick, lines, reminders, refillHidden } = useApp();
  const [autoAsk, setAutoAsk] = useState<{ m: ContinuousMedication; p: Product } | null>(null);
  // #33: os avisos que a pessoa ligou entram como itens iguais aos remédios da persona
  // #47: um cartão por item (original, cópia Pague Menos e equivalentes contam como o mesmo; vale o aviso mais novo)
  const allMeds = useMemo(() => {
    const persona = PERSONA.continuousMedications.filter((m) => !refillHidden.includes(m.productId));
    const seen = new Set(persona.map((m) => itemKeyOf(m.productId)));
    const mine = [...reminders].reverse().filter((r) => { const k = itemKeyOf(r.productId); if (seen.has(k)) return false; seen.add(k); return true; }).reverse();
    return [...persona, ...mine.flatMap((r) => { const p = PRODUCT_BY_ID.get(r.productId); return p ? [toMed(r, p)] : []; })];
  }, [reminders, refillHidden]);
  const ids = allMeds.map((m) => m.productId);
  const data = useAsync(async () => {
    const [prods, avail, delivery] = await Promise.all([commerce.products(ids), commerce.storesFor(ids), commerce.delivery()]);
    return { byId: new Map(prods.map((p) => [p.id, p])), avail, delivery };
  }, [commerce, ids.join()]);
  // #34: filtro com e sem receita
  const [filter, setFilter] = useState<"todos" | "rx" | "livre">("todos");
  const isRx = (m: ContinuousMedication) => !!data.data?.byId.get(m.productId)?.rx;
  // #39: sem receita primeiro, com receita no fim; dentro de cada grupo, o que acaba antes vem antes
  const meds = allMeds.filter((m) => filter === "todos" || (filter === "rx") === isRx(m))
    .sort((a, b) => Number(isRx(a)) - Number(isRx(b)) || daysLeft(a) - daysLeft(b));
  // #32: caixas para repor, por item (começa em 1)
  const [qty, setQty] = useState<Record<string, number>>({});
  const boxesOf = (id: string) => qty[id] ?? 1;
  // equivalente escolhido por item (sem escolha, vale o próprio item); guardado na sessão, só para a loja em que foi escolhido
  const choice = refillPick.storeId === storeId ? refillPick.picks : {};
  const pick = (id: string, product: Product | null) => dispatch({ type: "refillPick", id, product, storeId });
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(allMeds.map((m) => [m.productId, needsRefill(m)])));
  const isPicked = (m: ContinuousMedication) => picked[m.productId] ?? needsRefill(m);

  const chosen = (m: ContinuousMedication): Product | undefined => choice[m.productId] ?? data.data?.byId.get(m.productId);
  // #50: item que a loja escolhida não tem só entra na conta (e na retirada) depois que a pessoa escolhe um equivalente em estoque
  const hasHere = (m: ContinuousMedication) => hasStockHere({ productId: m.productId, chosenId: choice[m.productId]?.id, avail: data.data?.avail, storeId,
                                                              centralStockQty: data.data?.byId.get(m.productId)?.stockQty });
  const marked = allMeds.filter(isPicked);
  const dueCount = allMeds.filter((m) => needsRefill(m)).length;
  const unavailable = marked.filter((m) => !hasHere(m));
  const lineItems = marked.filter(hasHere).map((m) => ({ m, p: chosen(m) })).filter((x): x is { m: ContinuousMedication; p: Product } => !!x.p);
  const itemsCents = lineItems.reduce((t, { m, p }) => t + p.priceCents * boxesOf(m.productId), 0);   // #41: o total mostrado é o que a cesta cobra (o desconto da reposição automática não é aplicado no protótipo)
  const autoOn = (m: ContinuousMedication) => !!refillAuto[m.productId] && !isRx(m);
  /** Intervalo da reposição automática: quanto uma caixa dura. */
  const autoEveryOf = (m: ContinuousMedication, p: Product) => {
    const r = reminders.find((x) => x.productId === m.productId);
    return r ? boxDays(r, p) : Math.max(1, Math.floor(p.size.value / m.unitsPerDay));
  };
  const anyAuto = lineItems.some(({ m }) => autoOn(m));
  // receita só é pedida se algum item marcado precisa dela (suplemento e higiene não)
  const needsRx = marked.some(isRx);
  const canBuy = lineItems.length > 0 && (rxAttached || !lineItems.some(({ p }) => p.rx));
  const boxesTotal = lineItems.reduce((t, { m }) => t + boxesOf(m.productId), 0);

  const buy = () => {
    const full = lineItems.filter(({ p }) => lines.some((l) => l.type === "product" && l.product.id === p.id && l.qty >= maxQty(l)));   // #43: já no limite da receita
    for (const { m, p } of lineItems) {
      if (full.some((f) => f.p.id === p.id)) continue;
      // #35: reposição automática vai para a cesta com o intervalo de uma caixa; ao comprar, vira assinatura
      const every = autoOn(m) ? autoEveryOf(m, p) : undefined;
      const times = every ? refillAutoTimes[m.productId] ?? 2 : undefined;
      for (let i = 0; i < boxesOf(m.productId); i++) dispatch({ type: "addProduct", product: p, confirmed: true, autoEvery: every, autoTimes: times });
    }
    dispatch({ type: "attachRx", ids: lineItems.filter(({ p }) => p.rx).map(({ p }) => p.id) });   // receita anexada aqui mesmo
    const added = lineItems.length - full.length;
    const trocados = lineItems.filter(({ m, p }) => p.id !== m.productId).length;   // #46: equivalente escolhido segue sujeito ao farmacêutico
    dispatch({ type: "toast", text: (full.length ? `${added} ${added === 1 ? "item" : "itens"} da reposição na cesta; ${full.length === 1 ? "1 já estava" : `${full.length} já estavam`} no limite da receita` : `${lineItems.length} ${lineItems.length === 1 ? "item" : "itens"} da reposição na cesta`) + (trocados ? " Troca por equivalente: sujeita à confirmação do farmacêutico." : ""), action: "cart" });
    push({ name: "cart" });
  };

  const options = useMemo(() => {
    const d = data.data?.delivery.options ?? [];
    return [...d].sort((a, b) => DELIVERY_RANK(a.id) - DELIVERY_RANK(b.id)).map((o) => {
      // #45 (RDC 96/2008): só remédio na cesta, então nenhum frete grátis (nem por valor, nem pela reposição automática)
      const fee = o.id === "retirada" ? 0 : o.feeCents;
      return { o, fee, total: itemsCents + fee };
    });
  }, [data.data, itemsCents]);
  const best = options.length ? Math.min(...options.map((x) => x.total)) : 0;

  return (
    <div className="screen">
      <TitleBar title="Meus medicamentos" />
      <div className="scroll">
        <div className="pad refill-pad">
          {/* #39: topo enxuto: resumo numa linha, loja e privacidade numa linha só */}
          <div className="refill-top">
            <span className="grow"><b>{allMeds.length} {allMeds.length === 1 ? "item" : "itens"}</b>{dueCount ? <span className="refill-due"> · {dueCount} {dueCount === 1 ? "acabando" : "acabando"}</span> : null}</span>
          </div>
          <button className="row loc-row slim" onClick={() => push({ name: "stores" })}>
            <Icon name="store" size={18} />
            <span className="grow">{store ? <>Retirar na <b>{store.name}</b></> : "Escolher loja de retirada"}</span>
            <span className="btn-sm as-span">Trocar</span>
          </button>
          {/* #34: filtro com e sem receita */}
          <div className="seg refill-filter" role="group" aria-label="Filtrar itens">
            {([["todos", "Todos"], ["rx", "Com receita"], ["livre", "Sem receita"]] as const).map(([k, l]) => (
              <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          {autoAsk ? (
            <AutoSheet product={autoAsk.p} every={autoEveryOf(autoAsk.m, autoAsk.p)} current={refillAutoTimes[autoAsk.m.productId]}
              onClose={() => setAutoAsk(null)}
              onConfirm={(times) => { dispatch({ type: "setRefillAuto", id: autoAsk.m.productId, on: true, times }); setAutoAsk(null); }} />
          ) : null}

          {data.loading && !data.data ? <div className="skeleton" style={{ height: 220 }} /> : null}
          {data.error ? <div className="note danger" role="alert"><Icon name="alert" size={18} /><p>{data.error}</p></div> : null}

          {data.data
            ? meds.map((m) => (
                <MedCard key={m.productId} m={m} product={data.data!.byId.get(m.productId)} avail={data.data!.avail} storeId={storeId}
                  picked={isPicked(m)} onPick={(v) => setPicked({ ...picked, [m.productId]: v })}
                  auto={autoOn(m)} autoTimes={refillAutoTimes[m.productId]} autoEvery={data.data!.byId.get(m.productId) ? autoEveryOf(m, data.data!.byId.get(m.productId)!) : 30}
                  onAuto={(on) => { const p = data.data!.byId.get(m.productId); if (on && p) setAutoAsk({ m, p }); else dispatch({ type: "setRefillAuto", id: m.productId, on: false }); }}
                  onEditAuto={() => { const p = data.data!.byId.get(m.productId); if (p) setAutoAsk({ m, p }); }}
                  boxes={boxesOf(m.productId)} onBoxes={(n) => setQty({ ...qty, [m.productId]: n })}
                  onRemove={() => dispatch(m.userAdded ? { type: "remRemove", productId: m.productId } : { type: "refillHide", productId: m.productId, on: true })}
                  reminders={consent.refillReminders}
                  choice={choice[m.productId]} onChoice={(c) => pick(m.productId, c)} onReset={() => pick(m.productId, null)} />
              ))
            : null}
          {data.data && !meds.length ? <p className="sheet-text">{filter === "todos" ? "Nenhum item na Hora de repor. Toque em Adicionar." : `Nenhum item ${filter === "rx" ? "com" : "sem"} receita na sua lista.`}</p> : null}
          <p className="privacy-line"><Icon name="lock" size={14} /> Esta lista fica só neste aparelho e não vai para o assistente de compras.</p>

          {needsRx || allMeds.some(isRx) ? <section className="panel" aria-label="Receita">
            <div className="row"><Icon name="receipt" size={22} /><b>Receita (simulada)</b></div>
            {rxAttached ? (
              <p className="ok-line"><Icon name="checkCircle" size={18} /> Receita simulada anexada · válida até 30/03/2027 (data fictícia)</p>
            ) : (
              <p style={{ color: "var(--text-2)", fontSize: 14.5, lineHeight: 1.45 }}>Para repor, anexe a receita. Neste protótipo ela é simulada: nenhum documento real é enviado.</p>
            )}
            <button className={`btn ${rxAttached ? "outline" : "primary"} block`} onClick={() => dispatch({ type: "setRx", on: !rxAttached })}>
              {rxAttached ? "Remover receita simulada" : "Anexar receita simulada"}
            </button>
          </section> : null}

          {lineItems.length ? (
            <section className="panel" aria-label="Total com entrega">
              <b>Total com entrega</b>
              <small style={{ color: "var(--text-2)" }}>
                {boxesTotal} {boxesTotal === 1 ? "caixa" : "caixas"} · {money(itemsCents)}
              </small>
              <table className="quote">
                <tbody>
                  {options.map(({ o, fee, total }) => (
                    <tr key={o.id} className={total === best ? "best" : ""}>
                      <th scope="row">{o.label}<small>{o.eta}{o.id === PERSONA.preferences.deliveryPriority[0] ? " · sua preferência" : ""}</small></th>
                      <td>{fee === 0 ? "sem frete" : `frete ${money(fee)}`}</td>
                      <td><b>{money(total)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {anyAuto ? <small className="foot">{REFILL_RULES.note}</small> : null}
            </section>
          ) : null}

          <p className="footnote">Protótipo: medicamentos, preços, receita e lojas são fictícios.</p>
        </div>
      </div>
      <div className="summary">
        <small className="foot center" role="status">
          {!marked.length ? "Marque o que quer repor." : needsRx && !rxAttached ? "Para repor remédio com receita, anexe a receita (simulada)." : !lineItems.length ? "Escolha um equivalente em estoque para seguir."
            : `${boxesTotal} ${boxesTotal === 1 ? "caixa" : "caixas"} · ${money(itemsCents)}${unavailable.length ? ` · fora da conta, sem estoque nesta loja: ${unavailable.map((m) => m.label.replace(/\s*\(uso contínuo\)/i, "")).join(", ")}` : ""}`}
        </small>
        {/* #19: falta a receita? o botão principal vira a ação que falta, em vez de ficar apagado */}
        {needsRx && !rxAttached ? (
          <button className="btn primary block" onClick={() => dispatch({ type: "setRx", on: true })}>
            <Icon name="receipt" size={22} /> Anexar receita simulada
          </button>
        ) : (
          <button className="btn primary block" disabled={!canBuy} onClick={buy}>
            <Icon name="basketPlus" size={22} /> {lineItems.length ? `Repor ${boxesTotal} ${boxesTotal === 1 ? "caixa" : "caixas"} na cesta` : "Repor na cesta"}
          </button>
        )}
      </div>
    </div>
  );
}

function MedCard({ m, product, avail, storeId, picked, onPick, auto, autoTimes, autoEvery, onAuto, onEditAuto, reminders, choice, onChoice, onReset, boxes, onBoxes, onRemove }: {
  m: ContinuousMedication; product: Product | undefined; avail: StoreAvailability[]; storeId: string | null; picked: boolean; onPick: (v: boolean) => void;
  auto: boolean; autoTimes?: number; autoEvery: number; onAuto: (on: boolean) => void; onEditAuto: () => void; reminders: boolean; choice?: Product;
  onChoice: (c: Product) => void; onReset: () => void; boxes: number; onBoxes: (n: number) => void; onRemove: () => void;
}) {
  const { search } = useServices();
  const { dispatch } = useApp();
  const left = daysLeft(m);
  const urgent = needsRefill(m) && reminders;
  const pct = Math.max(4, Math.min(100, Math.round((m.unitsLeft / m.packUnits) * 100)));
  const here = storeId ? avail.find((a) => a.store.id === storeId) : null;
  const inStockHere = storeId ? !!here?.availableIds.includes(m.productId) : (product?.stockQty ?? 0) > 0;
  const nearest = avail.find((a) => a.availableIds.includes(m.productId) && a.store.id !== storeId);
  const [showEquiv, setShowEquiv] = useState(false);
  const sims = useAsync<SimilarsResponse | null>(() => (inStockHere || !showEquiv ? Promise.resolve(null) : search.similars(m.productId, storeId)), [search, m.productId, storeId, inStockHere, showEquiv]);
  const cur = choice ?? product;
  const swapped = !!product && !!choice && choice.id !== product.id;
  const cardRef = useRef<HTMLElement>(null);
  const [said, setSaid] = useState("");
  const focusCard = () => setTimeout(() => cardRef.current?.focus(), 0);
  if (!product || !cur) return null;
  const rx = !!product.rx;
  const choose = (p: Product) => { onChoice(p); onPick(true); setShowEquiv(false); setSaid(`${p.name} escolhido no lugar de ${product.name}.`); focusCard(); };
  const undo = () => { onReset(); setSaid(`Troca desfeita. Voltou ${product.name}.`); focusCard(); };
  const out = new Date(runOutDate(m));
  const ok = inStockHere || swapped;
  const lastAuto = autoTimes ? new Date(Date.now() + (autoTimes - 1) * autoEvery * 86_400_000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null;

  // #45: cabeçalho (marcar, etiquetas, remover) / corpo (foto, nome, data) / rodapé (preço, caixas) / opções, com espaçamento único de 12 px
  return (
    <article ref={cardRef} tabIndex={-1} className={`rc${rx ? " rx" : ""}${urgent ? " urgent" : ""}${picked ? " sel" : ""}`} aria-label={`${m.label}: ${cur.name}`}>
      <header className="rc-head">
        <label className="rc-check"><input type="checkbox" checked={picked} onChange={(e) => onPick(e.target.checked)} aria-label={`Incluir ${cur.name} na reposição`} /></label>
        <span className="med-tag">{m.label.replace(/\s*\(uso contínuo\)/i, "")}</span>
        {rx ? <span className="rx-tag"><Icon name="receipt" size={12} /> Receita</span> : null}
        <button className="icon-btn rc-remove" aria-label={`Remover ${cur.name} da Hora de repor`} onClick={onRemove}><Icon name="trash" size={18} /></button>
      </header>
      <div className="rc-body">
        <span className="rc-photo" title={`Restam ${m.unitsLeft}${m.unit === "dias" ? " dias" : ""} de ${m.packUnits} (${pct}%)`}><ProductImage product={cur} size={72} /></span>
        <div className="rc-info">
          <b className="rc-name">{cur.name}</b>
          {swapped ? <small className="swap-note">no lugar de {product.name} · {delta(cur.priceCents - product.priceCents)}</small> : null}
          <DateChip date={out} days={left} compact sub="" />
        </div>
      </div>
      <div className="rc-foot">
        {ok ? <span className="price blue">{money(cur.priceCents)}</span> : <span className="rc-out">Sem estoque</span>}
        <Stepper value={boxes} max={rx ? RX_MAX_QTY : 6} onChange={onBoxes} label={`caixas de ${cur.name}`} />
      </div>

      {!ok ? (
        <div className="rc-alert" role="alert">
          <p><Icon name="alert" size={16} /> Sem estoque{here ? ` na ${here.store.name}` : ""}{nearest ? `. Tem na ${nearest.store.name}, a ${nearest.distanceKm.toLocaleString("pt-BR")} km.` : " nas farmácias próximas."}</p>
          <div className="rc-alert-actions">
            {nearest ? <button className="btn-sm" onClick={() => dispatch({ type: "setStore", store: nearest.store })}><Icon name="store" size={15} /> Retirar lá</button> : null}
            <button className="btn-sm" onClick={() => setShowEquiv(!showEquiv)} aria-expanded={showEquiv}><Icon name={showEquiv ? "chevronUp" : "swap"} size={15} /> {showEquiv ? "Fechar" : "Equivalentes"}</button>
          </div>
        </div>
      ) : null}
      {showEquiv && !ok ? (
        <div className="equiv" aria-label="Equivalentes disponíveis">
          <small className="foot">Mesmo princípio ativo e mesma dose. A troca só vale depois que o farmacêutico confirmar (simulado).</small>
          {sims.loading ? <div className="skeleton" style={{ height: 48 }} /> : null}
          {(sims.data?.options ?? []).filter((o) => o.inStock && o.sameDose !== false).map((o) => (
            <div key={o.product.id} className="swap-opt">
              <ProductImage product={o.product} size={40} />
              <span className="grow"><b>{o.product.name}</b><small>{PRES[o.presentation ?? "similar"]} · {money(o.product.priceCents)} ({delta(o.deltaCents)})</small></span>
              <button className="btn-sm" aria-label={`Escolher ${o.product.name}`} onClick={() => choose(o.product)}>Escolher</button>
            </div>
          ))}
          {sims.data && !sims.data.options.some((o) => o.inStock) ? <p className="off">Nenhum equivalente em estoque nesta loja.</p> : null}
        </div>
      ) : null}
      {swapped ? <button className="btn-sm undo" onClick={undo}><Icon name="repeat" size={14} /> Voltar ao original</button> : null}
      <p className="sr-only" role="status">{said}</p>

      {canAuto(product) ? (
        <div className="rc-opt">
          <label className="rc-opt-row">
            <span className="grow">
              <b>Repor automaticamente</b>
              <small>{auto && autoTimes ? `${autoTimes} entregas · 1 a cada ${autoEvery} dias · última em ${lastAuto}` : "Aviso 5 dias antes, na véspera e no dia"}</small>
            </span>
            <input type="checkbox" role="switch" className="toggle sm" checked={auto} onChange={(e) => onAuto(e.target.checked)} aria-label="Repor automaticamente" />
          </label>
          {auto ? <button className="btn-sm" onClick={onEditAuto}>Alterar entregas</button> : null}
        </div>
      ) : (
        <div className="rc-opt rx-note"><Icon name="bell" size={15} /><span>Com receita, a reposição é manual. Aviso 5 dias antes, na véspera e no dia.</span></div>
      )}
    </article>
  );
}
