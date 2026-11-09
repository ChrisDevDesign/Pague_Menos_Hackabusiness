"""#63 (auditoria 09/11): cache compartilhado das leituras da DeepSeek. Sem rede: backend e cliente falsos."""
import json
import unittest

from graphrag.dialogue import Engine
from graphrag.llm import Reader
from graphrag.shared_cache import SharedCache

GRAPH = Engine.build()


class MemoryBackend:
    """Faz o papel do Redis da Vercel."""

    def __init__(self):
        self.data, self.ttl = {}, {}

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value, ttl_s):
        self.data[key], self.ttl[key] = value, ttl_s


class BrokenBackend:
    def get(self, key):
        raise TimeoutError("cache fora do ar")

    def set(self, key, value, ttl_s):
        raise TimeoutError("cache fora do ar")


class Fake:
    """DeepSeek falsa: conta as chamadas e lê "grudenta" como oleosidade."""

    def __init__(self):
        self.calls = 0

    def complete(self, system, user):
        self.calls += 1
        return json.dumps({"objetivos": ["oleosidade"], "preocupacoes": [], "ingredientes": [], "etapas": [], "evitar": [],
                           "preferencias": [], "orcamento_centavos": None, "pele": None,
                           "ajuste": {"evitar": [], "preferencias": [], "orcamento": None, "pele": None},
                           "palavras": {"grudenta": "oleosidade"}})


def engine(fake, shared):
    e = Engine(GRAPH.cat, GRAPH.graph, GRAPH.wv, GRAPH.clf, llm=fake)
    e.rag = Reader(GRAPH.cat, fake, shared=shared)
    return e


Q = {"query": "quero cuidar da pele que vive grudenta", "allowExternal": True}


class TestCacheCompartilhado(unittest.TestCase):
    def test_mesma_frase_so_paga_uma_vez_entre_servidores(self):
        backend = MemoryBackend()
        f1, f2 = Fake(), Fake()
        r1 = engine(f1, SharedCache(backend, "cat1")).search(dict(Q))          # servidor 1: paga
        r2 = engine(f2, SharedCache(backend, "cat1")).search(dict(Q))          # servidor 2: usa o que o 1 guardou
        self.assertEqual((f1.calls, f2.calls), (1, 0))
        self.assertEqual(r1["intent"]["primaryGoal"], r2["intent"]["primaryGoal"])
        self.assertEqual(r1["reply"], r2["reply"])                             # a resposta do cache é a mesma da API
        self.assertEqual([k["totalCents"] for k in r1["kits"]], [k["totalCents"] for k in r2["kits"]])
        self.assertEqual(r2["intent"]["primaryGoal"], "oleosidade")           # a leitura guardada passou pela mesma checagem
        self.assertEqual(next(iter(backend.ttl.values())), 30 * 86400)

    def test_cache_nao_guarda_o_texto_da_pessoa(self):
        backend = MemoryBackend()
        engine(Fake(), SharedCache(backend, "cat1")).search(dict(Q))
        blob = json.dumps(backend.data, ensure_ascii=False)
        self.assertNotIn("grudenta", blob)
        self.assertNotIn("cuidar da pele", blob)
        self.assertTrue(all(k.startswith("rag:v1:cat1:") and len(k) > 60 for k in backend.data))

    def test_catalogo_ou_versao_novos_recomecam_o_cache(self):
        backend = MemoryBackend()
        engine(Fake(), SharedCache(backend, "cat1")).search(dict(Q))
        f = Fake()
        engine(f, SharedCache(backend, "cat2")).search(dict(Q))
        self.assertEqual(f.calls, 1)
        f = Fake()
        engine(f, SharedCache(backend, "cat1", version="2")).search(dict(Q))   # RAG_CACHE_VERSION=2 limpa tudo
        self.assertEqual(f.calls, 1)

    def test_cache_fora_do_ar_segue_como_antes(self):
        f = Fake()
        shared = SharedCache(BrokenBackend(), "cat1")
        r = engine(f, shared).search(dict(Q))
        self.assertEqual(f.calls, 1)
        self.assertEqual(r["intent"]["primaryGoal"], "oleosidade")
        self.assertGreaterEqual(shared.status()["errors"], 1)

    def test_desligado_sem_variaveis(self):
        s = SharedCache(None, "cat1")
        self.assertFalse(s.status()["on"])
        self.assertIsNone(s.get("x", ()))


if __name__ == "__main__":
    unittest.main()
