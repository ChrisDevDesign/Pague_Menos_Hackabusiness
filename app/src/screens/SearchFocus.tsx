import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { SEARCH_HINT } from "../components/SearchHint";
import { MicButton, VoicePanel, useVoice } from "../components/Voice";
import { useNav } from "../nav";
import { useApp } from "../state/app";

const EXAMPLES = [
  "remédio para dor de cabeça",
  "estou gripado, com nariz entupido",
  "quero um kit de suplementos: ômega 3, colágeno e magnésio",
  "rotina anti idade premium até R$ 400, sem retinol",
  "higiene premium: shampoo, creme dental e desodorante",
  "preciso repor meus medicamentos",
  "protetor solar e manchas, sem perfume",
];

export function SearchFocus({ initial = "", voice: startVoice = false }: { initial?: string; voice?: boolean }) {
  const { pop, replace, view } = useNav();
  const { recents, dispatch, storeId } = useApp();
  const [q, setQ] = useState(initial);

  const go = (query: string) => {
    const t = query.trim();
    if (!t) return;
    dispatch({ type: "recent", q: t });
    replace({ name: "results", req: { query: t, storeId, context: null } });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(q);
  };
  // #10: a fala vira o texto da busca e a busca sai sozinha
  const voice = useVoice((t) => { setQ(t); go(t); });
  const auto = useRef(false);
  useEffect(() => {
    if (startVoice && !auto.current) { auto.current = true; voice.start(); }
  }, [startVoice, voice]);

  return (
    <div className="screen" style={{ background: "#fff" }} key={view.name}>
      <form className="bar" onSubmit={submit} role="search" style={{ boxShadow: "none" }}>
        <div className="searchfield" style={{ borderColor: "var(--brand)" }}>
          <Icon name="search" />
          <label className="sr-only" htmlFor="q">Buscar remédios, sintomas ou produtos</label>
          <input id="q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={SEARCH_HINT} autoComplete="off" enterKeyHint="search" />
          {q ? (
            <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setQ("")} aria-label="Apagar">
              <Icon name="close" size={18} />
            </button>
          ) : null}
          <MicButton voice={voice} className="in-field" label="Buscar por áudio" />
        </div>
        <button type="button" className="link plain" style={{ padding: "0 8px", minHeight: 44 }} onClick={pop}>Cancelar</button>
      </form>
      <VoicePanel voice={voice} hint="Fale o que você precisa, por exemplo: remédio para dor de cabeça" />
      <div className="scroll">
        <div className="pad">
          <div className="shortcuts" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <button type="button" className={`shortcut${voice.listening ? " on" : ""}`} style={{ minHeight: 84, alignItems: "center", textAlign: "center", border: 0 }}
              onClick={() => (voice.listening ? voice.stop() : voice.start())} aria-pressed={voice.listening}>
              <Icon name="mic" /> <b style={{ fontSize: 13 }}>{voice.listening ? "Ouvindo… toque para parar" : "Buscar por áudio"}</b>
            </button>
            <button type="button" className="shortcut" style={{ minHeight: 84, alignItems: "center", textAlign: "center", border: 0 }} onClick={() => replace({ name: "refill" })}>
              <Icon name="pill" /> <b style={{ fontSize: 13 }}>Meus medicamentos</b>
            </button>
            <button className="shortcut" style={{ minHeight: 84, alignItems: "center", textAlign: "center", border: 0 }} disabled title="Fora do protótipo">
              <Icon name="barcode" /> <b style={{ fontSize: 13 }}>Ler código de barras</b>
            </button>
          </div>
          <div className="note">
            <Icon name="sparkle" size={20} />
            <p>
              <b>Escreva do seu jeito</b> o que você precisa e quanto quer gastar. Você vê os kits montados e, logo abaixo, todos os itens relacionados. Também ajuda a repor o que você já usa.
            </p>
          </div>

          {recents.length ? (
            <section aria-label="Buscas recentes">
              <div className="sec-head">
                <h2 style={{ fontSize: 19 }}>Buscas recentes</h2>
                <button className="btn-sm" onClick={() => dispatch({ type: "clearRecents" })}><Icon name="trash" size={15} /> Limpar</button>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
                {recents.map((r) => (
                  <li key={r} className="row" style={{ borderBottom: "1px solid var(--line)", minHeight: 52 }}>
                    <button className="row grow" style={{ textAlign: "left", minHeight: 52, color: "var(--text-2)" }} onClick={() => go(r)}>
                      <Icon name="clock" size={20} /> <span className="grow">{r}</span>
                    </button>
                    <button className="icon-btn" onClick={() => dispatch({ type: "removeRecent", q: r })} aria-label={`Remover ${r}`}>
                      <Icon name="close" size={20} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-label="Exemplos">
            <h2 style={{ fontSize: 19 }}>Experimente</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
              {EXAMPLES.map((r) => (
                <li key={r}>
                  <button className="row" style={{ textAlign: "left", minHeight: 52, width: "100%", borderBottom: "1px solid var(--line)", color: "var(--text-2)" }} onClick={() => go(r)}>
                    <Icon name="search" size={20} /> <span className="grow">{r}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
