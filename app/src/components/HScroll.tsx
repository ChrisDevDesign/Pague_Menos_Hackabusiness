// #22 (auditoria 07/11): faixas que rolam para o lado (kits, vitrines, banners) também no computador.
// No celular continua o deslizar com o dedo. Com mouse: setas nas laterais e arrastar segurando o botão.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";

interface Props {
  className: string;
  style?: CSSProperties;
  children: ReactNode;
  "aria-label"?: string;
  tabIndex?: number;
}

const DRAG_START_PX = 6;

export function HScroll({ className, style, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ prev: false, next: false });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ prev: el.scrollLeft > 4, next: el.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", update); ro?.disconnect(); };
  }, [update]);

  // anda quase uma "página" da faixa, alinhando com os cartões
  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.8), behavior: "smooth" });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { x: e.clientX, left: ref.current!.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < DRAG_START_PX) return;
    if (!d.moved) {
      d.moved = true;
      el.classList.add("dragging");
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = d.left - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d?.moved || !el) return;
    el.classList.remove("dragging");
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    // arrastar não é tocar: o clique que vem logo depois é descartado
    const stop = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
    el.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => el.removeEventListener("click", stop, { capture: true }), 0);
  };

  return (
    <div className="hs-wrap">
      <div ref={ref} className={className} style={style} {...rest}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        onDragStart={(e) => e.preventDefault()}>
        {children}
      </div>
      {edges.prev ? (
        <button type="button" className="hs-arrow prev" aria-label="Ver anteriores" onClick={() => step(-1)}><Icon name="back" size={20} /></button>
      ) : null}
      {edges.next ? (
        <button type="button" className="hs-arrow next" aria-label="Ver próximos" onClick={() => step(1)}><Icon name="chevron" size={22} /></button>
      ) : null}
    </div>
  );
}
