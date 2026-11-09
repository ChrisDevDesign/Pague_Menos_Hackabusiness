"""#60 (auditoria 08/11): marca própria Pague Menos também no motor GraphRAG, com a mesma regra do app (#13)."""
import json
import math
import unittest
from pathlib import Path

from graphrag.dialogue import Engine, api_swap, api_swap_options

GRAPH = Engine.build()
APP_PRODUCTS = Path(__file__).resolve().parents[2] / "app" / "src" / "mocks" / "products.mock.json"


def app_price(cents: int) -> int:
    """ownBrandPrice do app (catalogData.ts), escrita de novo aqui."""
    p = math.floor((cents * 0.85) / 100) * 100 + 90
    while p >= cents:
        p -= 100
    return max(p, 190)


def S(q, ctx=None):
    return GRAPH.search({"query": q, "storeId": None, "context": ctx, "allowExternal": False})


class TestMarcaPropria(unittest.TestCase):
    def test_copias_iguais_as_do_app(self):
        app = {p["id"]: p for p in json.loads(APP_PRODUCTS.read_text(encoding="utf-8"))}
        own = [p for p in GRAPH.cat.products if p.get("ownBrand")]
        expected = [p for p in app.values() if p["domain"] in ("dermo", "higiene")]
        self.assertEqual(len(own), len(expected))
        for p in own:
            src = app[p["ownBrandOf"]]
            self.assertEqual(p["id"], "pm-" + src["id"])
            self.assertEqual(p["brand"], "Pague Menos")
            self.assertEqual(p["name"], src["name"])
            self.assertEqual(p["priceCents"], app_price(src["priceCents"]), p["id"])
            self.assertLess(p["priceCents"], src["priceCents"])
            self.assertEqual(p["cashbackPct"], max(src["cashbackPct"], 5))
        store = next(iter(GRAPH.cat.store_stock))
        for p in own[:20]:
            self.assertEqual(GRAPH.cat.stock_at(p["id"], store), GRAPH.cat.stock_at(p["ownBrandOf"], store))

    def test_kits_de_dermo_e_higiene_usam_a_marca_propria(self):
        for q in ("kit de skin care", "kit para acne", "kit de higiene"):
            r = S(q)
            self.assertTrue(r["kits"], q)
            brands = {it["product"]["brand"] for k in r["kits"] for it in k["items"]}
            self.assertIn("Pague Menos", brands, q)
        r = S("kit de suplementos")                     # suplemento não tem marca própria
        self.assertNotIn("Pague Menos", {it["product"]["brand"] for k in r["kits"] for it in k["items"]})

    def test_lista_mostra_original_e_copia(self):
        r = S("protetor solar facial")
        ids = {p["id"] for p in r["products"]}
        self.assertTrue(any(i.startswith("pm-") for i in ids))
        self.assertTrue(any(not i.startswith("pm-") for i in ids))

    def test_troca_em_kit_so_com_marca_propria(self):
        # o kit de exemplo de Assinaturas é montado com as cópias "pm-"; antes o motor respondia "Kit inválido."
        r = S("kit de higiene")
        kit = r["kits"][0]
        self.assertTrue(all(i["product"]["id"].startswith("pm-") for i in kit["items"]))
        step = kit["items"][0]["step"]
        opts = api_swap_options(GRAPH, kit, step, r["intent"])
        self.assertTrue(opts)
        new = api_swap(GRAPH, kit, step, opts[0]["product"]["id"], r["intent"])
        self.assertNotEqual(new["items"][0]["product"]["id"], kit["items"][0]["product"]["id"])


if __name__ == "__main__":
    unittest.main()
