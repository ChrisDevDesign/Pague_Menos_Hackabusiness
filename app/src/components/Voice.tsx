// Escuta por voz (#10 e #11): hook + painel "Ouvindo..." usados na busca e no Chat.
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, speechCtor } from "../services/speech";
import { Icon } from "./Icon";

export interface Voice {
  listening: boolean;
  text: string;
  error: string | null;
  supported: boolean;
  start: () => void;
  stop: () => void;
  dismiss: () => void;
}

export function useVoice(onFinal: (text: string) => void): Voice {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  const start = useCallback(() => {
    stopRef.current?.();
    setText("");
    setError(null);
    setListening(true);
    stopRef.current = listen(speechCtor(), {
      onInterim: setText,
      onFinal: (t) => { setText(t); finalRef.current(t); },
      onError: setError,
      onEnd: () => { setListening(false); stopRef.current = null; },
    });
  }, []);
  const stop = useCallback(() => stopRef.current?.(), []);
  const dismiss = useCallback(() => { stopRef.current?.(); setError(null); setText(""); }, []);
  useEffect(() => () => stopRef.current?.(), []);
  return { listening, text, error, supported: speechCtor() !== null, start, stop, dismiss };
}

/** Painel que aparece enquanto escuta (ou quando deu erro). */
export function VoicePanel({ voice, hint }: { voice: Voice; hint: string }) {
  if (!voice.listening && !voice.error) return null;
  return (
    <div className={`voice-panel${voice.error ? " err" : ""}`} role="status" aria-live="polite">
      {voice.error ? (
        <>
          <Icon name="alert" size={22} />
          <p className="grow">{voice.error}</p>
          <button className="icon-btn" onClick={voice.dismiss} aria-label="Fechar aviso"><Icon name="close" size={20} /></button>
        </>
      ) : (
        <>
          <span className="voice-wave" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="grow">
            <b>Ouvindo…</b>
            <small>{voice.text || hint}</small>
          </span>
          <button className="btn outline blue voice-stop" onClick={voice.stop}><Icon name="stop" size={18} /> Parar</button>
        </>
      )}
    </div>
  );
}

/** Botão de microfone redondo. */
export function MicButton({ voice, className = "", label = "Falar em vez de digitar" }: { voice: Voice; className?: string; label?: string }) {
  return (
    <button type="button" className={`mic-btn ${voice.listening ? "on" : ""} ${className}`} aria-pressed={voice.listening}
      aria-label={voice.listening ? "Parar de ouvir" : label} title={voice.listening ? "Parar de ouvir" : label}
      onClick={() => (voice.listening ? voice.stop() : voice.start())}>
      <Icon name={voice.listening ? "stop" : "mic"} size={22} />
    </button>
  );
}
