// Experimento "Hora de repor": 5 quadrados acima do celular. Cada um prepara o cenário e abre o app
// exatamente onde aquele fluxo aparece, para comparar qual funciona melhor.
import { useState } from "react";
import { useNav } from "../nav";
import { PRODUCT_BY_ID } from "../services/mock/catalogData";
import { DAY_MS } from "../services/reminders";
import { useApp, type CartLine, type Order } from "../state/app";

/** Itens de um pedido típico: suplemento, remédio de uso contínuo, higiene, e dois que NÃO entram (dermo pontual fica; analgésico sai). */
const ORDER_ITEMS = ["p107", "p132", "p119", "p001", "p149"];

const FLOWS = [
  { n: 1, title: "Página do produto", text: "Link \"Avisar quando acabar\" embaixo do botão de compra; só marca, pergunta no fim." },
  { n: 2, title: "Pedido confirmado", text: "Depois de pagar: cartão com só os itens que fazem sentido repor." },
  { n: 3, title: "Lembrete depois", text: "Quem tocou \"Agora não\" vê, na Home, \"Chegou tudo?\" uma única vez." },
  { n: 4, title: "Segunda compra", text: "Item que já veio em pedido anterior aparece primeiro, com \"Você já comprou\"." },
  { n: 5, title: "Cadastro manual", text: "Em Meus medicamentos: \"+ Adicionar item\", busca e as 2 perguntas." },
] as const;

let seq = 0;
function makeOrder(ids: string[], daysAgo: number, storeName: string | null): Order {
  const lines: CartLine[] = ids.map((id) => PRODUCT_BY_ID.get(id)).filter((p) => !!p).map((p) => ({ key: `p:${p!.id}`, type: "product", product: p!, qty: 1 }));
  const items = lines.reduce((t, l) => t + (l.type === "product" ? l.product.priceCents : 0), 0);
  const id = `X${Date.now().toString(36).slice(-4).toUpperCase()}${seq++}`;
  return { id, createdAt: new Date(Date.now() - daysAgo * DAY_MS).toISOString(), lines, itemsCents: items, feeCents: 0, totalCents: items, cashbackCents: 0,
    mode: "retirada", storeName, payment: "Pix", status: "Pedido recebido (simulado)" };
}

export function DemoBar() {
  const { resetAll } = useNav();
  const { dispatch, store } = useApp();
  const [active, setActive] = useState<number | null>(null);

  const go = (n: number) => {
    setActive(n);
    const storeName = store?.name ?? null;
    dispatch({ type: "remDemoReset" });
    if (n === 1) {
      resetAll("home", { name: "product", id: "p107" });
    } else if (n === 2) {
      const o = makeOrder(ORDER_ITEMS, 0, storeName);
      dispatch({ type: "placeOrder", order: o });
      resetAll("mais", { name: "done", orderId: o.id });
    } else if (n === 3) {
      const o = makeOrder(ORDER_ITEMS, 2, storeName);
      dispatch({ type: "placeOrder", order: o });
      dispatch({ type: "remSkip", orderId: o.id });   // como se a pessoa tivesse tocado "Agora não" no fim do pedido
      resetAll("home");
    } else if (n === 4) {
      dispatch({ type: "placeOrder", order: makeOrder(["p107", "p132"], 28, storeName) });   // pedido do mês passado
      const o = makeOrder(ORDER_ITEMS, 0, storeName);
      dispatch({ type: "placeOrder", order: o });
      resetAll("mais", { name: "done", orderId: o.id });
    } else {
      resetAll("home", { name: "refill", add: true });
    }
  };

  return (
    <nav className="demo-bar" aria-label="Experimento Hora de repor">
      <div className="demo-head">
        <b>Experimento · Hora de repor</b>
        <span>Toque num quadrado: o app abre onde aquele fluxo aparece. Os avisos ligados ficam em Meus medicamentos.</span>
      </div>
      <div className="demo-tiles">
        {FLOWS.map((f) => (
          <button key={f.n} className={`demo-tile${active === f.n ? " on" : ""}`} aria-pressed={active === f.n} onClick={() => go(f.n)}>
            <span className="demo-n">{f.n}</span>
            <b>{f.title}</b>
            <small>{f.text}</small>
          </button>
        ))}
      </div>
    </nav>
  );
}
