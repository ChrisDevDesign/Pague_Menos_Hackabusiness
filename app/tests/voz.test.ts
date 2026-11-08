import { describe, expect, it } from "vitest";
import { SPEECH_ERRORS, listen, speechCtor, type RecognitionLike, type SpeechResultEvent } from "../src/services/speech";

// #10 e #11 (auditoria 07/11): busca por áudio na busca e no Chat, com o reconhecimento de voz do navegador simulado
class FakeRec implements RecognitionLike {
  static last: FakeRec | null = null;
  lang = ""; interimResults = false; continuous = true; maxAlternatives = 5;
  onresult: ((e: SpeechResultEvent) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false; stopped = false;
  constructor() { FakeRec.last = this; }
  start() { this.started = true; }
  stop() { this.stopped = true; this.onend?.(); }
  abort() { this.onerror?.({ error: "aborted" }); this.onend?.(); }
  say(parts: Array<[string, boolean]>, from = 0) {
    this.onresult?.({ resultIndex: from, results: parts.map(([t, f]) => ({ isFinal: f, 0: { transcript: t } })) });
  }
}

const collect = () => {
  const ev = { interim: [] as string[], final: [] as string[], errors: [] as string[], ended: 0 };
  return { ev, h: { onInterim: (t: string) => ev.interim.push(t), onFinal: (t: string) => ev.final.push(t), onError: (m: string) => ev.errors.push(m), onEnd: () => { ev.ended++; } } };
};

describe("busca por áudio", () => {
  it("ouve em português, mostra o parcial e entrega a frase final ao terminar", () => {
    const { ev, h } = collect();
    const stop = listen(FakeRec, h)!;
    const rec = FakeRec.last!;
    expect(rec.lang).toBe("pt-BR");
    expect(rec.interimResults).toBe(true);
    expect(rec.started).toBe(true);
    rec.say([["remédio para", false]]);
    rec.say([["remédio para dor de cabeça ", true]]);
    expect(ev.interim.at(-1)).toBe("remédio para dor de cabeça");
    expect(ev.final).toEqual([]);   // só entrega quando a escuta acaba
    stop();
    expect(ev.final).toEqual(["remédio para dor de cabeça"]);
    expect(ev.ended).toBe(1);
  });

  it("sem suporte no navegador, avisa e não quebra", () => {
    const { ev, h } = collect();
    expect(listen(null, h)).toBeNull();
    expect(ev.errors).toEqual([SPEECH_ERRORS.unsupported]);
    expect(ev.ended).toBe(1);
    expect(speechCtor({})).toBeNull();
    expect(speechCtor({ webkitSpeechRecognition: FakeRec })).toBe(FakeRec);
  });

  it("microfone bloqueado vira mensagem clara e nada é enviado", () => {
    const { ev, h } = collect();
    listen(FakeRec, h);
    const rec = FakeRec.last!;
    rec.say([["kit", true]]);
    rec.onerror?.({ error: "not-allowed" });
    rec.onend?.();
    expect(ev.errors[0]).toMatch(/microfone foi bloqueado/);
    expect(ev.final).toEqual([]);
  });

  it("silêncio não envia frase vazia; cancelar (abort) não mostra erro", () => {
    const { ev, h } = collect();
    listen(FakeRec, h);
    FakeRec.last!.abort();
    expect(ev.errors).toEqual([]);
    expect(ev.final).toEqual([]);
    expect(ev.ended).toBe(1);
  });
});
