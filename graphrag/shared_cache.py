"""#63 (auditoria 09/11): cache COMPARTILHADO das leituras da DeepSeek.

A mesma frase só é paga uma vez para todo mundo: na primeira vez o motor pergunta à DeepSeek e guarda a leitura; nas
próximas (em qualquer servidor da Vercel, mesmo depois de uma nova publicação) usa a leitura guardada.

O que NÃO muda: o grafo não aprende nada com isso e a DeepSeek também não (é um serviço fechado). A leitura guardada
passa pelas mesmas checagens do motor toda vez que é usada (dialogue._rag), então uma leitura que o motor recusa
continua recusada.

Cuidados:
- chave = código embaralhado (SHA-256) da frase já sem dados pessoais (llm.scrub), da conversa em rótulos e das
  palavras desconhecidas; o texto da pessoa nunca é guardado como chave;
- valor = só rótulos do catálogo; as palavras desconhecidas viram posições (0, 1...) em vez do texto;
- validade de 30 dias (RAG_CACHE_TTL_DAYS) e versão do catálogo na chave: mudou o catálogo, o cache recomeça;
- limpar tudo na hora: trocar RAG_CACHE_VERSION na Vercel;
- falha segura: cache fora do ar ou lento (mais de 0,8 s) = o motor segue como antes, chamando a DeepSeek.

Backend: Redis da Vercel (Upstash, API REST), pelas variáveis KV_REST_API_URL e KV_REST_API_TOKEN (ou
UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN). Sem elas, fica desligado e só vale o cache em memória de sempre.
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
import urllib.parse
import urllib.request

from .text import norm

TIMEOUT_S = 0.8


def _k(w) -> str:
    """Mesma forma que o leitor usa para comparar palavras (llm.Reader.key)."""
    return norm(str(w).replace("_", " "))


def fingerprint(product_ids, goal_ids) -> str:
    """Versão do catálogo: muda quando entra, sai ou muda de id algum produto ou objetivo."""
    h = hashlib.sha256(("|".join(sorted(product_ids)) + "#" + "|".join(sorted(goal_ids))).encode()).hexdigest()
    return h[:10]


class SharedCache:
    def __init__(self, backend, catalog_version: str, ttl_days: int = 30, version: str = "1"):
        self.backend = backend                     # objeto com get(key) -> str|None e set(key, value, ttl_s); None = desligado
        self.prefix = f"rag:v{version}:{catalog_version}:"
        self.ttl_s = max(1, int(ttl_days)) * 86400
        self.lock = threading.Lock()
        self.hits = self.misses = self.writes = self.errors = 0

    @classmethod
    def from_env(cls, catalog_version: str) -> "SharedCache":
        url = os.environ.get("KV_REST_API_URL") or os.environ.get("UPSTASH_REDIS_REST_URL")
        token = os.environ.get("KV_REST_API_TOKEN") or os.environ.get("UPSTASH_REDIS_REST_TOKEN")
        backend = UpstashRest(url, token) if url and token else None
        return cls(backend, catalog_version, int(os.environ.get("RAG_CACHE_TTL_DAYS", "30")),
                   os.environ.get("RAG_CACHE_VERSION", "1").strip() or "1")

    @property
    def on(self) -> bool:
        return self.backend is not None

    def key(self, clean: str, conversation: str, unknown: tuple) -> str:
        raw = json.dumps([clean, conversation, list(unknown)], ensure_ascii=False)
        return self.prefix + hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, key: str, unknown: tuple) -> dict | None:
        if not self.on:
            return None
        try:
            val = self.backend.get(key)
        except Exception:
            with self.lock:
                self.errors += 1
            return None
        with self.lock:
            if val is None:
                self.misses += 1
                return None
            self.hits += 1
        try:
            data = json.loads(val)
        except ValueError:
            return None
        return _restore_words(data, unknown)

    def set(self, key: str, parsed: dict, unknown: tuple) -> None:
        if not self.on or parsed is None:
            return
        try:
            self.backend.set(key, json.dumps(_hide_words(parsed, unknown), ensure_ascii=False), self.ttl_s)
            with self.lock:
                self.writes += 1
        except Exception:
            with self.lock:
                self.errors += 1

    def status(self) -> dict:
        with self.lock:
            looked = self.hits + self.misses
            return {"on": self.on, "backend": type(self.backend).__name__ if self.on else None,
                    "hits": self.hits, "misses": self.misses, "writes": self.writes, "errors": self.errors,
                    "hitRate": round(self.hits / looked, 4) if looked else None}


def _hide_words(parsed: dict, unknown: tuple) -> dict:
    """As palavras desconhecidas (texto da pessoa) viram a posição delas na lista; só os rótulos do catálogo ficam."""
    out = dict(parsed)
    idx = {w: i for i, w in enumerate(unknown)}
    idx.update({_k(w): i for i, w in enumerate(unknown)})    # "explicadas" usa a forma normalizada da palavra
    if isinstance(out.get("palavras"), dict):
        out["palavras"] = {str(idx[w]): v for w, v in out["palavras"].items() if w in idx}
    if isinstance(out.get("explicadas"), list):              # [palavra, campo, id] -> [posição, campo, id]
        out["explicadas"] = [[idx[e[0]], *e[1:]] for e in out["explicadas"] if e and e[0] in idx]
    return out


def _restore_words(data: dict, unknown: tuple) -> dict:
    out = dict(data)
    ok = lambda i: isinstance(i, int) and 0 <= i < len(unknown)
    if isinstance(out.get("palavras"), dict):
        out["palavras"] = {unknown[int(i)]: v for i, v in out["palavras"].items() if i.isdigit() and int(i) < len(unknown)}
    if isinstance(out.get("explicadas"), list):
        out["explicadas"] = [[_k(unknown[e[0]]), *e[1:]] for e in out["explicadas"] if e and ok(e[0])]
    return out


class UpstashRest:
    """Redis da Vercel pela API REST (sem biblioteca extra, funciona na função Python da Vercel)."""

    def __init__(self, url: str, token: str):
        self.url, self.token = url.rstrip("/"), token

    def _call(self, path: str, body: str | None = None):
        req = urllib.request.Request(self.url + path, data=body.encode("utf-8") if body is not None else None,
                                     method="POST" if body is not None else "GET",
                                     headers={"Authorization": f"Bearer {self.token}"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            return json.loads(r.read()).get("result")

    def get(self, key: str) -> str | None:
        return self._call("/get/" + urllib.parse.quote(key, safe=""))

    def set(self, key: str, value: str, ttl_s: int) -> None:
        self._call(f"/set/{urllib.parse.quote(key, safe='')}?EX={int(ttl_s)}", value)
