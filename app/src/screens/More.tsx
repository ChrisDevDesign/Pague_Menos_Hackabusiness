import { ProductImage } from "../components/ProductImage";
import { useState } from "react";
import { PersonaAvatar } from "../components/Avatar";
import { TitleBar } from "../components/Bars";
import { Icon, type IconName } from "../components/Icon";
import type { ProductImage as Img } from "../contracts/types";
import { BRAND } from "../brand";
import { SIMULATED_LOCATION } from "../location";
import { PERSONA } from "../persona";
import { CATEGORY_PHOTOS, KIT_PROMO_PHOTO, PROFILE_PHOTO, photoCredit, photoUrl } from "../photos";
import { useNav, useServices, type View } from "../nav";
import { money } from "../services/format";
import { lineProducts, useApp, type Order } from "../state/app";
import { useAsync } from "../useAsync";

const ROWS: Array<{ label: string; icon: IconName; to?: View; off?: string }> = [
  { label: "Meus pedidos", icon: "box", to: { name: "orders" } },
  { label: "Assinaturas", icon: "repeat", to: { name: "subscriptions" } },
  { label: "Carteira e cashback", icon: "wallet", to: { name: "wallet" } },
  { label: "Lojas e retirada", icon: "store", to: { name: "stores" } },
  { label: "Meus medicamentos", icon: "pill", to: { name: "refill" } },
  { label: "Privacidade e dados", icon: "lock", to: { name: "privacy" } },
  { label: "Convênios e PBM", icon: "shield", off: "fora do protótipo" },
  { label: "Créditos das fotos", icon: "image", to: { name: "credits" } },
];

export function More() {
  const { push } = useNav();
  return (
    <div className="screen">
      <TitleBar title="Mais" back={false} />
      <div className="scroll">
        <div className="pad">
          <div className="panel row">
            <PersonaAvatar size={56} />
            <span className="grow">
              <b style={{ fontWeight: 500 }}>{PERSONA.name}</b>
              <br />
              <small style={{ color: "var(--text-2)" }}>{PERSONA.address.neighborhood}, {PERSONA.address.city} - {PERSONA.address.uf} · persona fictícia</small>
            </span>
          </div>
          <div className="menulist">
            {ROWS.map((r) => (
              <button key={r.label} className="menurow" disabled={!r.to} onClick={() => r.to && push(r.to)}>
                <span className="ico"><Icon name={r.icon} size={26} /></span>
                <span>{r.label}</span>
                {r.to ? <Icon name="chevron" size={20} /> : <small>{r.off}</small>}
              </button>
            ))}
          </div>
          <p className="footnote">{BRAND.protoNote} Medicamentos aparecem só avulsos, nunca em kit; convênios ficam fora do escopo.</p>
        </div>
      </div>
    </div>
  );
}

export function Orders() {
  const { orders } = useApp();
  const { resetTo } = useNav();
  return (
    <div className="screen">
      <TitleBar title="Meus pedidos" />
      <div className="scroll">
        <div className="pad orders-pad">
          {!orders.length ? (
            <div className="empty">
              <span className="art"><Icon name="box" size={90} strokeWidth={1} /></span>
              <h2>Nenhum pedido ainda</h2>
              <button className="btn primary" onClick={() => resetTo("home")}>Começar a comprar</button>
            </div>
          ) : (
            orders.map((o) => <OrderCard key={o.id} o={o} />)
          )}
        </div>
      </div>
    </div>
  );
}

/** #41: pedido em cartão de app: onde e quando, status, fotos dos itens, total e ações. */
function OrderCard({ o }: { o: Order }) {
  const { dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const prods = o.lines.flatMap(lineProducts);
  const count = o.lines.reduce((t, l) => t + l.qty * (l.type === "kit" ? l.kit.items.length : 1), 0);
  const when = new Date(o.createdAt);
  const waiting = o.status.startsWith("Aguardando");
  const again = () => {
    for (const l of o.lines) {
      for (let i = 0; i < l.qty; i++) {
        if (l.type === "kit") dispatch({ type: "addKit", kit: l.kit, intent: l.intent, everyDays: l.everyDays });
        else dispatch({ type: "addProduct", product: l.product });
      }
    }
  };
  return (
    <article className="order-card">
      <header className="order-head">
        <span className="order-ico"><Icon name={o.mode === "retirada" ? "store" : "truck"} size={20} /></span>
        <span className="grow">
          <b>{o.mode === "retirada" ? `Retirada · ${o.storeName ?? "loja"}` : o.mode === "expressa" ? "Entrega expressa" : "Entrega agendada"}</b>
          <small>{when.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} às {when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · Pedido {o.id}</small>
        </span>
        <span className={`order-status${waiting ? " warn" : ""}`}>{o.status.replace(" (simulado)", "")}</span>
      </header>
      <div className="order-thumbs">
        {prods.slice(0, 4).map((p, i) => <ProductImage key={p.id + i} product={p} size={56} />)}
        {prods.length > 4 ? <span className="order-more">+{prods.length - 4}</span> : null}
      </div>
      <div className="order-sum">
        <span>{count} {count === 1 ? "item" : "itens"} · {o.payment}</span>
        <b>{money(o.totalCents)}</b>
      </div>
      {open ? (
        <ul className="order-lines">
          {o.lines.map((l) => (
            <li key={l.key}>
              <span className="grow">{l.qty}× {l.type === "kit" ? `Kit ${l.kit.title}${l.everyDays ? ` · assinatura a cada ${l.everyDays} dias` : ""}` : l.product.name}{l.type === "product" && l.autoEvery ? " · reposição automática" : ""}</span>
              <span>{money((l.type === "kit" ? l.kit.totalCents : l.product.priceCents) * l.qty)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="order-actions">
        <button className="btn outline" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Menos detalhes" : "Ver detalhes"}</button>
        <button className="btn primary" onClick={again}><Icon name="basketPlus" size={18} /> Comprar de novo</button>
      </div>
    </article>
  );
}

export function Wallet() {
  const { walletPendingCents, cashbackCents } = useApp();
  return (
    <div className="screen">
      <TitleBar title="Carteira e cashback" />
      <div className="scroll">
        <div className="pad">
          <div className="panel" style={{ gap: 4 }}>
            <span className="section-title">Cashback a receber</span>
            <span className="price blue" style={{ fontSize: 28 }}>{money(walletPendingCents)}</span>
            <small style={{ color: "var(--text-2)" }}>Dos pedidos simulados guardados neste aparelho</small>
          </div>
          {cashbackCents > 0 ? <div className="note ok"><Icon name="wallet" size={18} /><p>A cesta atual rende {money(cashbackCents)} de cashback.</p></div> : null}
          <div className="note"><Icon name="info" size={18} /><p>Percentuais de cashback são premissas do protótipo. As regras reais do programa podem ser diferentes.</p></div>
        </div>
      </div>
    </div>
  );
}

export function Stores() {
  const { commerce } = useServices();
  const { store, dispatch } = useApp();
  const { pop } = useNav();
  const data = useAsync(() => commerce.storesFor([]), [commerce]);
  return (
    <div className="screen">
      <TitleBar title="Lojas e retirada" />
      <div className="scroll">
        <div className="pad">
          <p style={{ color: "var(--text-2)", lineHeight: 1.45 }}>
            Escolha a loja onde quer retirar. Os kits passam a usar só o que ela tem em estoque. Lojas fictícias perto de {SIMULATED_LOCATION.label}.
          </p>
          <button className="store" aria-pressed={!store} onClick={() => { dispatch({ type: "setStore", store: null }); pop(); }}>
            <span className="t"><Icon name="truck" /> <span className="grow">Receber em casa</span></span>
            <span className="addr">Kits com o estoque do centro de distribuição</span>
          </button>
          {(data.data ?? []).map((s) => (
            <button key={s.store.id} className="store" aria-pressed={store?.id === s.store.id}
              onClick={() => { dispatch({ type: "setStore", store: s.store }); dispatch({ type: "setMode", mode: "retirada" }); pop(); }}>
              <span className="t">
                <span style={{ color: "var(--logo)" }}><Icon name="cross" /></span>
                <span className="grow">{s.store.name}{s.store.open24h ? " 24 Horas." : ""}</span>
              </span>
              <span><span className="open">Aberta</span> · <span style={{ color: "var(--text-2)" }}>{s.store.hours}</span></span>
              <span className="addr">{s.store.address} (endereço fictício)</span>
              <span className="chips"><span className="mini">{s.distanceKm.toLocaleString("pt-BR")} km</span><span className="mini">Retirar em até 60 minutos</span></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Credits() {
  const { commerce } = useServices();
  const data = useAsync(async () => {
    const [cats, home] = await Promise.all([commerce.categories(), commerce.home()]);
    const all = await commerce.products([...new Set(cats.flatMap((c) => c.productIds))]);
    // #16/#18: retrato da persona, fotos das categorias e do atalho de kit também entram nos créditos
    const extra: Img[] = [PROFILE_PHOTO, KIT_PROMO_PHOTO, ...Object.values(CATEGORY_PHOTOS)].map((f) => ({ src: photoUrl(f, 80), alt: "", credit: photoCredit(f) }));
    const imgs: Img[] = [...extra, ...all.flatMap((p) => p.images), ...home.banners];
    const seen = new Map<string, Img>();
    for (const i of imgs) seen.set(i.credit.pageUrl, i);
    return [...seen.values()];
  }, [commerce]);
  return (
    <div className="screen">
      <TitleBar title="Créditos das fotos" />
      <div className="scroll">
        <div className="pad">
          <p style={{ lineHeight: 1.5 }}>
            Fotos do <a className="link" href="https://unsplash.com/?utm_source=pague_menos_prototipo&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>, sob a{" "}
            <a className="link" href="https://unsplash.com/license" target="_blank" rel="noreferrer">licença Unsplash</a>. São fotos ilustrativas, escolhidas sem marca legível; os produtos do app são fictícios.
          </p>
          {data.data && !data.data.length ? <div className="note warn"><Icon name="info" size={18} /><p>O banco de imagens ainda não foi revisado. Por enquanto, os produtos aparecem com desenho provisório.</p></div> : null}
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 14 }}>
            {(data.data ?? []).map((i) => (
              <li key={i.credit.pageUrl}>
                Foto de <a className="link" href={i.credit.photographerUrl} target="_blank" rel="noreferrer">{i.credit.photographer}</a> no{" "}
                <a className="link" href={i.credit.pageUrl} target="_blank" rel="noreferrer">{i.credit.source}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
