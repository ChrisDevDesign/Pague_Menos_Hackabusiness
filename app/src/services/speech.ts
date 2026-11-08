// Busca por áudio (#10 e #11 da auditoria de 07/11): usa o reconhecimento de voz do próprio navegador (Web Speech API).
// O app não grava nem guarda áudio; quem transcreve é o serviço de voz do navegador (no Chrome, os servidores do Google).

export interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionCtor = new () => RecognitionLike;

/** O construtor de reconhecimento de voz do navegador, se existir. */
export function speechCtor(w: unknown = typeof window === "undefined" ? undefined : window): RecognitionCtor | null {
  const g = w as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor } | undefined;
  return g?.SpeechRecognition ?? g?.webkitSpeechRecognition ?? null;
}

export const SPEECH_ERRORS: Record<string, string> = {
  "not-allowed": "O microfone foi bloqueado. Libere o acesso ao microfone nas configurações do navegador.",
  "service-not-allowed": "O microfone foi bloqueado. Libere o acesso ao microfone nas configurações do navegador.",
  "no-speech": "Não ouvi nada. Toque no microfone e fale de novo.",
  "audio-capture": "Não encontrei um microfone neste aparelho.",
  network: "O serviço de voz do navegador não respondeu. Confira a internet ou digite.",
  unsupported: "Este navegador não tem busca por voz. Use o Chrome, o Edge ou o Safari, ou digite.",
};

export interface SpeechHandlers {
  /** Texto parcial enquanto a pessoa fala. */
  onInterim(text: string): void;
  /** Frase final (já sem espaços sobrando). */
  onFinal(text: string): void;
  onError(message: string): void;
  /** Escuta terminou (com ou sem resultado). */
  onEnd(): void;
}

/** Abre uma escuta em português. Devolve a função que para a escuta, ou null se não há suporte. */
export function listen(Ctor: RecognitionCtor | null, h: SpeechHandlers): (() => void) | null {
  if (!Ctor) {
    h.onError(SPEECH_ERRORS.unsupported);
    h.onEnd();
    return null;
  }
  const rec = new Ctor();
  rec.lang = "pt-BR";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = "";
  let failed = false;
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    h.onInterim((finalText + interim).trim());
  };
  rec.onerror = (e) => {
    if (e.error === "aborted") return;
    failed = true;
    h.onError(SPEECH_ERRORS[e.error] ?? "Não consegui ouvir agora. Tente de novo ou digite.");
  };
  rec.onend = () => {
    const t = finalText.replace(/\s+/g, " ").trim();
    if (t && !failed) h.onFinal(t);
    h.onEnd();
  };
  try {
    rec.start();
  } catch {
    h.onError("Não consegui abrir o microfone. Tente de novo.");
    h.onEnd();
    return null;
  }
  return () => rec.stop();
}
