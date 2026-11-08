// Mais > Assinaturas (#9): lista e edição de cada assinatura de kit.
// Ações: mudar a frequência (30 ou 60 dias), pular o próximo envio, trocar ou tirar item, pausar e cancelar de vez.
import { useState } from "react";
import { TitleBar } from "../components/Bars";
import { BottomSheet } from "../components/BottomSheet";
import { Icon } from "../components/Icon";
import { OwnBrandTag } from "../components/OwnBrandTag";
import { ProductImage } from "../components/ProductImage";
import type { StepId, SwapOption } from "../contracts/types";
import { STEP_LABEL } from "../contracts/types";
import { useNav, useServices } from "../nav";
import { delta, money } from "../services/format";
import { changeEvery, fmtDate, removeItem, replaceKit, setPaused, skipNext, type SubEvery, type Subscription } from "../services/subscriptions";
import { useApp } from "../state/app";

export function Subscriptions() {
  const { subscriptions } = useApp();
  const { push, resetTo } = useNav();
  return (
    <div className="screen">
      <TitleBar title="Assinaturas" />
      <div className="scroll">
        <div className="pad">
          <div className="note"><Icon name="repeat" size={18} /><p>Receba seu kit de novo a cada 30 ou 60 dias. Pule um envio, troque itens ou cancele quando quiser, sem custo (simulado).</p></div>
          {!subscriptions.length ? (
            <div className="empty">
              <span className="art"><Icon name="repeat" size={80} strokeWidth={1} /></span>
              <h2>Nenhuma assinatura</h2>
              <p>Na tela de um kit, escolha "Assinar" antes de pôr na cesta.</p>
              <button className="btn primary" onClick={() => resetTo("home", { name: "searchFocus" })}>Montar um kit</button>
            </div>
          ) : null}
          {subscriptions.map((s) => (
            <article key={s.id} className="panel sub-card">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="grow">
                  <b className="sub-title">Kit {s.kit.title}</b>
                  <small className="sub-meta">A cada {s.everyDays} dias · {s.kit.items.length} itens</small>
                </span>
                <span className={`mini ${s.status === "ativa" ? "green" : "warn"}`}>{s.status === "ativa" ? "Ativa" : "Pausada"}</span>
              </div>
              <div className="kit-thumbs">{s.kit.items.map((i) => <ProductImage key={i.product.id} product={i.product} size={48} />)}</div>
              <div className="sub-next">
                <Icon name="truck" size={18} />
                <span className="grow">{s.status === "ativa" ? <>Próximo envio em <b>{fmtDate(s.nextAt)}</b></> : "Sem envios enquanto estiver pausada"}</span>
                <b className="price blue" style={{ fontSize: 17 }}>{money(s.kit.totalCents)}</b>
              </div>
              {s.sample ? <small className="sub-meta">Exemplo do protótipo: experimente as ações.</small> : null}
              <button className="btn outline blue block" onClick={() => push({ name: "subscription", id: s.id })}>
                <Icon name="settings" size={20} /> Gerenciar assinatura
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

type Sheet = { kind: "swap"; step: StepId } | { kind: "cancel" } | { kind: "remove"; productId: string; name: string } | null;

export function SubscriptionEdit({ id }: { id: string }) {
  const { subscriptions, dispatch } = useApp();
  const { search } = useServices();
  const { pop } = useNav();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [options, setOptions] = useState<SwapOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const s = subscriptions.find((x) => x.id === id);

  if (!s) {
    return (
      <div className="screen">
        <TitleBar title="Assinatura" />
        <div className="pad"><div className="empty"><h2>Assinatura não encontrada</h2><p>Ela pode ter sido cancelada.</p><button className="btn primary" onClick={pop}>Voltar</button></div></div>
      </div>
    );
  }

  const save = (sub: Subscription, toast: string) => dispatch({ type: "subSet", sub, toast });
  const setEvery = (d: SubEvery) => {
    if (d === s.everyDays) return;
    const n = changeEvery(s, d);
    save(n, `Agora a cada ${d} dias. Próximo envio em ${fmtDate(n.nextAt)}.`);
  };
  const openSwap = async (step: StepId) => {
    setSheet({ kind: "swap", step });
    setOptions(null);
    setError(null);
    try {
      setOptions(await search.swapOptions(s.kit, step, s.intent));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as opções.");
    }
  };
  const pickSwap = async (step: StepId, productId: string) => {
    try {
      const kit = await search.swap(s.kit, step, productId, s.intent);
      save(replaceKit(s, kit), `${STEP_LABEL[step]} trocado. O kit agora custa ${money(kit.totalCents)} por envio.`);
      setSheet(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível trocar o item.");
    }
  };
  const doRemove = (productId: string) => {
    const n = removeItem(s, productId);
    if (n) save(n, `Item tirado. O kit agora custa ${money(n.kit.totalCents)} por envio.`);
    setSheet(null);
  };
  const paused = s.status === "pausada";

  return (
    <div className="screen">
      <TitleBar title="Gerenciar assinatura" />
      <div className="scroll">
        <div className="pad">
          <section className="panel" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <b className="sub-title grow">Kit {s.kit.title}</b>
              <span className={`mini ${paused ? "warn" : "green"}`}>{paused ? "Pausada" : "Ativa"}</span>
            </div>
            <small className="sub-meta">Assinada em {fmtDate(s.createdAt)}{s.storeName ? ` · ${s.storeName}` : ""}{s.skips ? ` · ${s.skips} ${s.skips === 1 ? "envio pulado" : "envios pulados"}` : ""}</small>
            <div className="sumrow total"><span>Por envio</span><b>{money(s.kit.totalCents)}</b></div>
            {s.kit.discountPct ? <small className="kit-off">Desconto do kit {s.kit.discountPct}% já aplicado</small> : null}
          </section>

          <section className="panel" aria-labelledby="sub-freq">
            <span id="sub-freq" className="section-title">Frequência</span>
            <div className="seg" role="group" aria-label="Receber a cada">
              {([30, 60] as SubEvery[]).map((d) => (
                <button key={d} aria-pressed={s.everyDays === d} onClick={() => setEvery(d)}>A cada {d} dias</button>
              ))}
            </div>
            <small className="sub-meta">{s.everyDays === 30 ? "Está acabando devagar? Adie para 60 dias." : "Precisa antes? Volte para 30 dias."}</small>
          </section>

          <section className="panel" aria-labelledby="sub-next">
            <span id="sub-next" className="section-title">Próximo envio</span>
            <div className="sub-next">
              <Icon name="truck" size={20} />
              <span className="grow">{paused ? "Pausada: nenhum envio até você retomar" : <><b>{fmtDate(s.nextAt)}</b> · o seguinte {s.everyDays} dias depois</>}</span>
            </div>
            <button className="btn outline blue block" disabled={paused}
              onClick={() => { const n = skipNext(s); save(n, `Envio de ${fmtDate(s.nextAt)} cancelado. Próximo em ${fmtDate(n.nextAt)}.`); }}>
              <Icon name="skip" size={20} /> Pular só o próximo envio
            </button>
            <button className="btn outline block" onClick={() => save(setPaused(s, !paused), paused ? "Assinatura retomada." : "Assinatura pausada. Nenhum envio até você retomar.")}>
              <Icon name={paused ? "play" : "pause"} size={20} /> {paused ? "Retomar assinatura" : "Pausar assinatura"}
            </button>
          </section>

          <section className="panel" aria-labelledby="sub-items">
            <span id="sub-items" className="section-title">Itens do kit</span>
            {s.kit.items.map((it) => (
              <div key={it.product.id} className="sub-item">
                <ProductImage product={it.product} size={56} />
                <span className="grow">
                  <small className="step-label">{STEP_LABEL[it.step]}</small>
                  <b>{it.product.name}</b>
                  <span className="sub-meta">{it.product.brand} · {money(it.product.priceCents)}</span>
                  {it.product.ownBrand ? <OwnBrandTag small /> : null}
                </span>
                <span className="sub-item-actions">
                  <button className="textbtn" onClick={() => void openSwap(it.step)} aria-label={`Trocar ${it.product.name}`}><Icon name="swap" size={16} /> Trocar</button>
                  <button className="textbtn danger" disabled={s.kit.items.length <= 1} onClick={() => setSheet({ kind: "remove", productId: it.product.id, name: it.product.name })}
                    aria-label={`Tirar ${it.product.name}`}><Icon name="trash" size={16} /> Tirar</button>
                </span>
              </div>
            ))}
          </section>

          <button className="btn danger-outline block" onClick={() => setSheet({ kind: "cancel" })}>
            <Icon name="close" size={20} /> Cancelar assinatura de vez
          </button>
          <p className="footnote">Assinatura simulada: nada é cobrado nem enviado.</p>
        </div>
      </div>

      {sheet?.kind === "swap" ? (
        <BottomSheet title={`Trocar: ${STEP_LABEL[sheet.step]}`} onClose={() => setSheet(null)}>
          {error ? <div className="note danger" role="alert"><Icon name="alert" size={18} /><p>{error}</p></div> : null}
          {!options && !error ? <div className="skeleton" style={{ height: 120 }} role="status" aria-label="Carregando opções" /> : null}
          {options?.length === 0 ? <p className="footnote">Nenhuma outra opção para este item.</p> : null}
          {options?.filter((o) => o.compatible).map((o) => (
            <button key={o.product.id} className="opt" onClick={() => void pickSwap(sheet.step, o.product.id)}>
              <ProductImage product={o.product} size={52} />
              <span className="info">
                <b>{o.product.name}</b>
                <small>{o.product.brand} · {money(o.product.priceCents)}</small>
                {o.product.ownBrand ? <OwnBrandTag small /> : null}
              </span>
              <span className={`d ${o.deltaCents > 0 ? "up" : o.deltaCents < 0 ? "down" : ""}`}>{delta(o.deltaCents)}</span>
            </button>
          ))}
        </BottomSheet>
      ) : null}

      {sheet?.kind === "remove" ? (
        <BottomSheet title="Tirar item do kit?" onClose={() => setSheet(null)}>
          <p className="sheet-text">{sheet.name} sai dos próximos envios. O desconto do kit é recalculado pelo número de itens.</p>
          <button className="btn primary block" onClick={() => doRemove(sheet.productId)}>Tirar item</button>
          <button className="btn outline block" onClick={() => setSheet(null)}>Manter</button>
        </BottomSheet>
      ) : null}

      {sheet?.kind === "cancel" ? (
        <BottomSheet title="Cancelar de vez?" onClose={() => setSheet(null)}>
          <p className="sheet-text">A assinatura do Kit {s.kit.title} acaba agora e nenhum envio novo será feito. Para só dar um tempo, use "Pausar" ou "Pular só o próximo envio".</p>
          <button className="btn danger block" onClick={() => { dispatch({ type: "subCancel", id: s.id }); setSheet(null); pop(); }}>Sim, cancelar assinatura</button>
          <button className="btn outline block" onClick={() => { save(setPaused(s, true), "Assinatura pausada. Nenhum envio até você retomar."); setSheet(null); }}>Pausar em vez de cancelar</button>
          <button className="btn outline blue block" onClick={() => setSheet(null)}>Manter assinatura</button>
        </BottomSheet>
      ) : null}
    </div>
  );
}
