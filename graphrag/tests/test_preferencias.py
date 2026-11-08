"""#49 (auditoria 08/11): "sem fragrância" não pode travar o kit por causa de escova, pente ou fio dental."""
import unittest

from graphrag.composer import pref_ok
from graphrag.dialogue import Engine

GRAPH = Engine.build()


def run(e, q, ctx=None):
    return e.search({"query": q, "storeId": None, "context": ctx, "allowExternal": True})


class TestPreferencias(unittest.TestCase):
    def test_tira_perfume_do_kit_de_higiene_monta_kit(self):
        e = Engine(GRAPH.cat, GRAPH.graph, GRAPH.wv, GRAPH.clf)
        r1 = run(e, "kit de higiene pra viagem, coisa basica")
        r2 = run(e, "tira o que tem perfume", r1["context"])
        self.assertIn("sem fragrância", r2["intent"]["preferences"])
        self.assertEqual(len(r2["kits"]), 3)
        for k in r2["kits"]:
            for it in k["items"]:
                self.assertTrue(pref_ok(it["product"], "sem fragrância"), it["product"]["name"])

    def test_escopo_da_preferencia(self):
        by_type = {}
        for p in GRAPH.cat.products:
            by_type.setdefault(p["productType"], p)
        self.assertTrue(pref_ok(by_type["escova de dente"], "sem fragrância"))
        self.assertTrue(pref_ok(by_type["creme dental"], "sem fragrância"))
        shampoo = [p for p in GRAPH.cat.products if p["productType"] == "shampoo" and "sem fragrância" not in p["claims"]][0]
        self.assertFalse(pref_ok(shampoo, "sem fragrância"))
        self.assertTrue(pref_ok(shampoo, "sem alumínio"))          # alumínio só existe em desodorante


if __name__ == "__main__":
    unittest.main()
