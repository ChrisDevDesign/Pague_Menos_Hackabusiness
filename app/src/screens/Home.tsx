import { PersonaAvatar } from "../components/Avatar";
import { HScroll } from "../components/HScroll";
import { BasketButton } from "../components/Bars";
import { Icon, LogoMark } from "../components/Icon";
import { ProductCard } from "../components/ProductCard";
import { SEARCH_HINT } from "../components/SearchHint";
import type { Product } from "../contracts/types";
import { BRAND } from "../brand";
import { useNav, useServices } from "../nav";
import { SIMULATED_LOCATION } from "../location";
import { PERSONA, daysLeft, needsRefill, REFILL_RULES } from "../persona";
import { useApp } from "../state/app";
import { useAsync } from "../useAsync";
import { CATEGORY_PHOTOS, KIT_PROMO_PHOTO, photoUrl } from "../photos";
import { TOP_CATEGORIES } from "../topCategories";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function Home() {
  const { push, goTab } = useNav();
  const { commerce } = useServices();
  const { store, storeId, consent } = useApp();
  const due = PERSONA.continuousMedications.filter((m) => needsRefill(m)).length;
  const soonest = Math.min(...PERSONA.continuousMedications.map(daysLeft));
  // quanto ainda resta do remédio que acaba primeiro (barra do cartão de reposição, #17)
  const first = PERSONA.continuousMedications.reduce((a, b) => (daysLeft(b) < daysLeft(a) ? b : a));
  const leftPct = Math.max(6, Math.round((first.unitsLeft / first.packUnits) * 100));
  const meds = PERSONA.continuousMedications.length;
  const home = useAsync(async () => {
    const h = await commerce.home();
    const rows = await Promise.all(
      h.showcases.filter((s) => s.type === "products").map(async (s) => ({ s, products: await commerce.products(s.productIds ?? [], "relevancia") })),
    );
    return { ...h, rows };
  }, [commerce]);
  const banner = home.data?.banners ?? [];

  return (
    <div className="screen">
      <div className="scroll">
        {/* #15: cabeçalho azul único: saudação, busca e loja, tudo dentro do azul */}
        <div className="home-head">
          <div className="row">
            <LogoMark size={40} />
            <p className="hello">
              {greeting()},<br /><b>{PERSONA.firstName}!</b>
            </p>
            <button className="icon-btn avatar-btn" onClick={() => goTab("mais")} aria-label="Meu perfil"><PersonaAvatar size={40} ring /></button>
            <BasketButton />
          </div>
          <div className="searchpill">
            <button className="searchpill-go" onClick={() => push({ name: "searchFocus" })}>
              <Icon name="search" />
              <span className="ph">{SEARCH_HINT}</span>
            </button>
            {/* #8: o microfone abre a busca já ouvindo */}
            <button className="icon-btn soft" onClick={() => push({ name: "searchFocus", voice: true })} aria-label="Buscar por áudio" title="Buscar por áudio">
              <Icon name="mic" />
            </button>
          </div>
          <button className="loc-chip" onClick={() => push({ name: "stores" })}>
            <Icon name={store ? "store" : "pin"} size={18} />
            <span>{store ? <>Retirar na <b>{store.name}</b> · {store.neighborhood}</> : SIMULATED_LOCATION.label}</span>
            <Icon name="chevronDown" size={18} />
          </button>
        </div>

        <div className="pad">
          {/* #29 e #17: Meus medicamentos sempre no topo; vira "Hora de repor" quando algo está acabando.
              O nome dos remédios não aparece aqui (rótulo privado, só em "Meus medicamentos"). */}
          {consent.refillReminders && due > 0 ? (
            <button className="refill-card" onClick={() => push({ name: "refill" })}>
              <span className="refill-ico"><Icon name="bell" size={24} /></span>
              <span className="grow">
                <b>Hora de repor</b>
                <small>{due} {due === 1 ? "remédio de uso contínuo acaba" : "remédios de uso contínuo acabam"} em até {REFILL_RULES.alertDaysBefore} dias</small>
                <span className="refill-meter" aria-hidden="true"><i style={{ width: `${leftPct}%` }} /></span>
                <small className="refill-when">{soonest === 0 ? "O primeiro acaba hoje" : `O primeiro acaba em ${soonest} ${soonest === 1 ? "dia" : "dias"}`}</small>
              </span>
              <span className="cta">Repor<Icon name="chevron" size={18} /></span>
            </button>
          ) : (
            <button className="refill-card calm" onClick={() => push({ name: "refill" })}>
              <span className="refill-ico"><Icon name="pill" size={24} /></span>
              <span className="grow">
                <b>Meus medicamentos</b>
                <small>{meds} de uso contínuo · {soonest === 0 ? "um deles acaba hoje" : `próximo acaba em ${soonest} ${soonest === 1 ? "dia" : "dias"}`}</small>
              </span>
              <span className="cta">Ver<Icon name="chevron" size={18} /></span>
            </button>
          )}
          <section aria-labelledby="h-cat">
            <div className="sec-head">
              <h2 id="h-cat">Categorias</h2>
              <button className="link plain" onClick={() => push({ name: "categorias" })}>Ver todas</button>
            </div>
            {/* #16: círculos com foto nas categorias ativas; as de fora do protótipo ficam menores, com "Em breve" */}
            <div className="cat-tiles">
              {TOP_CATEGORIES.filter((c) => c.id).map((c) => {
                const photo = c.id ? CATEGORY_PHOTOS[c.id] : undefined;
                return (
                  <button key={c.label} className={`cat-tile${c.id === "pague-menos" ? " own" : ""}`} onClick={() => push({ name: "category", id: c.id! })} aria-label={c.label}>
                    <span className="cat-img">
                      {photo ? <img src={photoUrl(photo, 160)} alt="" loading="lazy" /> : <LogoMark size={40} />}
                    </span>
                    <span className="cat-name">{c.short ?? c.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="cat-soon" aria-label="Em breve">
              {TOP_CATEGORIES.filter((c) => !c.id).map((c) => (
                <span key={c.label} className="soon-chip"><Icon name={c.icon} size={16} />{c.short ?? c.label}</span>
              ))}
              <span className="soon-tag">Em breve</span>
            </div>
          </section>
          {/* #17: atalho de kit com foto, frase de apoio e seta */}
          <button className="kit-promo" onClick={() => push({ name: "searchFocus" })}>
            <img src={photoUrl(KIT_PROMO_PHOTO, 180)} alt="" loading="lazy" />
            <span className="grow">
              <span className="pill-new">Novo</span>
              <b>Monte um kit pelo que você precisa</b>
              <small>Diga o problema e quanto quer gastar: a rotina vem pronta, em 3 faixas de preço.</small>
            </span>
            <Icon name="chevron" size={22} />
          </button>

          <HScroll className="banners" aria-label="Destaques">
            <button className="banner" onClick={() => push({ name: "searchFocus" })}>
              {banner[0] ? <img src={banner[0].src} alt="" /> : null}
              <span className="shade" />
              <span className="txt">
                <b>Kits inteligentes</b>
                <span>Diga o que precisa: a rotina vem completa, sem item repetido e no seu orçamento.</span>
                <span className="cta">Montar meu kit</span>
              </span>
            </button>
            <button className="banner" onClick={() => push({ name: "stores" })}>
              {banner[1] ? <img src={banner[1].src} alt="" /> : null}
              <span className="shade" />
              <span className="txt">
                <b>Kit completo na sua loja</b>
                <span>Escolha a loja e os kits usam só o que ela tem em estoque. Retire em até 60 minutos.</span>
                <span className="cta">Escolher loja</span>
              </span>
            </button>
            <button className="banner" onClick={() => push({ name: "category", id: "solar-facial" })}>
              {banner[2] ? <img src={banner[2].src} alt="" /> : null}
              <span className="shade" />
              <span className="txt">
                <b>Protetor solar facial</b>
                <span>Toque seco, com cor ou mineral.</span>
                <span className="cta">Ver produtos</span>
              </span>
            </button>
          </HScroll>

          <section aria-labelledby="h-kits">
            <div className="sec-head">
              <h2 id="h-kits">Kits inteligentes para você</h2>
            </div>
            <HScroll className="presets" style={{ marginTop: 12 }}>
              {(home.data?.kitPresets ?? []).map((k) => (
                <button key={k.id} className="preset" onClick={() => push({ name: "results", req: { query: k.query, storeId } })}>
                  <Icon name="sparkle" size={22} />
                  <b>{k.label}</b>
                  <small>3 faixas de preço</small>
                </button>
              ))}
            </HScroll>
          </section>

          {home.loading && !home.data ? <div className="skeleton" style={{ height: 260 }} /> : null}
          {(home.data?.rows ?? []).map(({ s, products }) => (
            <Shelf key={s.id} title={s.id === "ofertas" ? "Aproveite as Melhores Ofertas para Você!" : s.title} products={products}
              tag={s.id === "ofertas" ? "Super oferta" : undefined} />
          ))}
          <p className="footnote">{BRAND.protoNote}</p>
        </div>
      </div>
    </div>
  );
}

function Shelf({ title, products, tag }: { title: string; products: Product[]; tag?: string }) {
  if (!products.length) return null;
  return (
    <section aria-label={title}>
      <div className="sec-head">
        <h2>{title}</h2>
      </div>
      <HScroll className="hscroll" style={{ marginTop: 12 }}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} tag={tag} />
        ))}
      </HScroll>
    </section>
  );
}
