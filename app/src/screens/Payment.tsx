import { useRef, useState } from "react";
import { ReminderOffer, type AutoPick } from "../components/Reminders";
import { ProductImage } from "../components/ProductImage";
import type { Reminder } from "../services/reminders";
import { TitleBar } from "../components/Bars";
import { Icon } from "../components/Icon";
import { useNav, useServices } from "../nav";
import { money } from "../services/format";
import { rxPending, rxProducts, useApp, type Order } from "../state/app";
import { lineProducts } from "../state/app";
import { useAsync } from "../useAsync";
import { feeFor } from "./Delivery";

const PAYMENTS = [
  { id: "pix", label: "Pix", hint: "Código gerado na confirmação (simulado)" },
  { id: "cartao", label: "Cartão de crédito", hint: "Sem campos de cartão: pagamento simulado" },
  { id: "retirada", label: "Pagar na retirada", hint: "Na loja, no balcão" },
] as const;

export function Payment() {
  const { lines, count, itemsCents, shippingBaseCents, listCents, cashbackCents, mode, store, dispatch, rxDocs } = useApp();
  const rxMissing = rxPending(lines, rxDocs).length;   // #28: sem todas as receitas, não paga
  const { resetAll, push } = useNav();
  const { commerce } = useServices();
  const [pay, setPay] = useState<(typeof PAYMENTS)[number]["id"]>("pix");
  const del = useAsync(() => commerce.delivery(), [commerce]);
  const opt = del.data?.options.find((o) => o.id === mode);
  const fee = feeFor(opt, shippingBaseCents);
  const total = itemsCents + fee;

  const confirm = () => {
    if (rxMissing) return;
    if (!mode || !lines.length) return;
    const order: Order = {
      id: `SIM-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      createdAt: new Date().toISOString(),
      lines,
      itemsCents,
      feeCents: fee,
      totalCents: total,
      cashbackCents,
      mode,
      storeName: mode === "agendada" ? null : (store?.name ?? null),
      payment: PAYMENTS.find((p) => p.id === pay)!.label,
      status: rxProducts(lines).length ? "Aguardando avaliação da receita pelo farmacêutico (simulado)" : mode === "retirada" ? "Separando para retirada (simulado)" : pay === "pix" ? "Aguardando pagamento Pix (simulado)" : "Pedido recebido (simulado)",
    };
    dispatch({ type: "placeOrder", order });
    resetAll("mais", { name: "done", orderId: order.id });
  };

  return (
    <div className="screen">
      <TitleBar title="Pagamento" />
      <div className="scroll">
        <div className="pad">
          <div className="note warn" role="note"><Icon name="info" size={18} /><p>Simulação: nenhum pagamento é processado e nenhum dado de pagamento é enviado.</p></div>
          {rxProducts(lines).length ? <div className="note" role="note"><Icon name="receipt" size={18} /><p>Este pedido tem remédio com receita: na loja real, um farmacêutico avalia a receita antes de separar o pedido. Neste protótipo isso é só o aviso e o status do pedido: não há avaliação de verdade.</p></div> : null}
          <div className="panel" style={{ gap: 4 }}>
            <span className="section-title">Receber</span>
            <span style={{ fontSize: 15 }}>
              {opt ? opt.label : "Carregando..."}{opt && store && mode !== "agendada" ? ` · ${store.name}` : ""}
            </span>
            <small style={{ color: "var(--text-2)" }}>{opt?.eta}</small>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <legend className="section-title" style={{ marginBottom: 8 }}>Forma de pagamento</legend>
            {PAYMENTS.filter((p) => p.id !== "retirada" || mode === "retirada").map((p) => (
              <label key={p.id} className="radio" data-sel={pay === p.id}>
                <input type="radio" name="pay" checked={pay === p.id} onChange={() => setPay(p.id)} />
                <span className="grow"><b style={{ fontWeight: 500 }}>{p.label}</b><small>{p.hint}</small></span>
              </label>
            ))}
          </fieldset>
          <div className="panel" style={{ gap: 4 }}>
            <div className="sumrow"><span>Subtotal ({count} {count === 1 ? "item" : "itens"})</span><span>{money(listCents)}</span></div>
            {listCents > itemsCents ? <div className="sumrow"><span>Descontos</span><span>- {money(listCents - itemsCents)}</span></div> : null}
            <div className="sumrow"><span>Entrega</span><span>{fee ? money(fee) : "Grátis"}</span></div>
            <div className="sumrow total" style={{ fontSize: 18, borderTop: "1px dashed var(--line)", paddingTop: 8, marginTop: 4 }}>
              <span>Total</span><span>{money(total)}</span>
            </div>
            {cashbackCents > 0 ? <div className="sumrow" style={{ color: "var(--ok)" }}><span>Cashback a receber</span><span>{money(cashbackCents)}</span></div> : null}
          </div>
        </div>
      </div>
      <div className="sticky">
        {rxMissing ? (
          <button className="note warn" style={{ textAlign: "left", width: "100%" }} onClick={() => push({ name: "prescriptions" })}>
            <Icon name="alert" size={18} /><span>Falta anexar {rxMissing === 1 ? "1 receita" : `${rxMissing} receitas`}. Anexar receitas</span>
          </button>
        ) : null}
        <button className="btn primary block" disabled={!mode || !lines.length || !opt || rxMissing > 0} onClick={confirm}>Finalizar pedido simulado</button>
      </div>
    </div>
  );
}

export function Confirmation({ orderId }: { orderId: string }) {
  const { orders, dispatch, reminderSkipped } = useApp();
  const { replace, resetTo } = useNav();
  const o = orders.find((x) => x.id === orderId);
  // fluxos 2 e 4: itens do pedido que fazem sentido repor; o que já veio em pedido anterior ganha destaque
  const bought = o ? o.lines.flatMap(lineProducts) : [];
  const boxes = new Map<string, number>();
  for (const l of o?.lines ?? []) for (const p of lineProducts(l)) boxes.set(p.id, (boxes.get(p.id) ?? 0) + l.qty);
  const before = new Map<string, string>();
  for (const old of orders) {
    if (!o || old.id === o.id || Date.parse(old.createdAt) >= Date.parse(o.createdAt)) continue;
    for (const p of old.lines.flatMap(lineProducts)) if (!before.has(p.id)) before.set(p.id, new Date(old.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
  }
  const skipped = !!o && reminderSkipped.includes(o.id);
  // #37: item marcado e não ativado liga o aviso ao sair desta tela
  const pending = useRef<Reminder[]>([]);
  const pendingAuto = useRef<AutoPick[]>([]);
  const leave = (go: () => void) => {
    if (pending.current.length) dispatch({ type: "remAdd", reminders: pending.current });
    // #46: reposição automática escolhida e não confirmada em "Ativar" também vale ao sair (a pessoa já escolheu as entregas)
    if (o && pendingAuto.current.length) dispatch({ type: "autoStart", items: pendingAuto.current, orderId: o.id, createdAt: o.createdAt, storeName: o.storeName });
    go();
  };
  const where = o ? (o.mode === "retirada" ? `Retirar na ${o.storeName ?? "loja"}` : o.mode === "expressa" ? "Entrega expressa" : "Entrega agendada") : "";

  return (
    <div className="screen">
      <TitleBar title="Pedido confirmado" back={false} />
      <div className="scroll">
        <div className="pad confirm-pad">
          <section className="confirm-hero" aria-live="polite">
            <span className="confirm-check"><Icon name="check" size={34} /></span>
            <div>
              <h2>Pedido confirmado!</h2>
              {o ? <p>Nº {o.id} · <b>{money(o.totalCents)}</b></p> : null}
            </div>
            {o ? <span className="mini green confirm-status">{o.status}</span> : null}
          </section>

          {o && !skipped ? (
            <ReminderOffer products={bought} source={before.size ? 4 : 2} boughtBefore={before.size ? before : undefined} boxesById={boxes}
              order={{ id: o.id, createdAt: o.createdAt, storeName: o.storeName }}
              onPending={(list, auto) => { pending.current = list; pendingAuto.current = auto; }}
              onSkip={() => { pending.current = []; pendingAuto.current = []; dispatch({ type: "remSkip", orderId: o.id }); }} />
          ) : null}

          {o ? (
            <section className="panel confirm-card" aria-label="Resumo do pedido">
              <div className="confirm-row"><Icon name={o.mode === "retirada" ? "store" : "truck"} size={20} /><span className="grow"><b>{where}</b><small>{o.mode === "retirada" ? "Pronto em até 60 minutos (simulado)" : "Acompanhe em Meus pedidos"}</small></span></div>
              <div className="confirm-row"><Icon name="wallet" size={20} /><span className="grow"><b>{o.payment}</b>{o.cashbackCents ? <small>{money(o.cashbackCents)} de cashback a receber</small> : <small>Pagamento simulado</small>}</span></div>
              <span className="section-title">Itens ({o.lines.reduce((t, l) => t + l.qty, 0)})</span>
              <ul className="confirm-items">
                {o.lines.map((l) => (
                  <li key={l.key}>
                    {l.type === "product" ? <ProductImage product={l.product} size={44} /> : <span className="confirm-kit"><Icon name="sparkle" size={20} /></span>}
                    <span className="grow"><b>{l.type === "product" ? l.product.name : `Kit ${l.kit.title}`}</b><small>{l.qty}× · {money((l.type === "product" ? l.product.priceCents : l.kit.totalCents) * l.qty)}</small></span>
                  </li>
                ))}
              </ul>
              <div className="sumrow total"><span>Total</span><b>{money(o.totalCents)}</b></div>
            </section>
          ) : null}
          <p className="footnote">Demonstração: nada foi cobrado e o pedido não foi enviado a nenhuma loja; ele fica só neste navegador.</p>
        </div>
      </div>
      <div className="sticky confirm-actions">
        <button className="btn primary block" onClick={() => leave(() => replace({ name: "orders" }))}>Ver meus pedidos</button>
        <button className="btn outline block" onClick={() => leave(() => resetTo("home"))}>Continuar comprando</button>
      </div>
    </div>
  );
}
