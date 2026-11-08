"""#24 e #25 (auditoria 08/11): o "sem" precisa tirar o item dos kits e da lista, não devolver o mesmo pedido."""
import unittest

from graphrag.dialogue import Engine
from graphrag.text import norm

ENGINE = Engine.build()


def run(query, context=None):
    return ENGINE.search({"query": query, "storeId": None, "context": context, "allowExternal": False})


class TestExclusoes(unittest.TestCase):
    def test_leitor_separa_tipo_etapa_e_deixa_ingrediente_para_o_nlu(self):
        r = ENGINE.nlu.exclusions
        self.assertEqual(r.read("kits de skin care sem gel de limpeza facial").types, ["gel de limpeza"])
        self.assertEqual(r.read("kit de skin care sem limpeza").steps, ["limpeza"])
        self.assertFalse(r.read("remedio para dor de cabeca sem ser dipirona"))       # ativo: fica com o nlu
        self.assertFalse(r.read("kit sem fragrancia e sem gastar muito"))            # preferência e resto da frase

    def test_24_kit_sem_gel_de_limpeza_mantem_a_etapa_com_outro_formato(self):
        r = run("me de kits de skin care sem gel de limpeza facial")
        self.assertEqual(r["intent"]["primaryGoal"], "skincare_basico")
        self.assertEqual(r["intent"].get("exclude"), ["gel de limpeza"])
        self.assertTrue(r["kits"])
        for k in r["kits"]:
            types = [norm(i["product"]["productType"]) for i in k["items"]]
            self.assertNotIn("gel de limpeza", types)
            self.assertIn("limpeza", [i["step"] for i in k["items"]])
        self.assertFalse(any(norm(p["productType"]) == "gel de limpeza" for p in r["products"]))
        self.assertTrue(r["reply"].startswith("Sem gel de limpeza."))

    def test_24_sem_limpeza_tira_a_etapa(self):
        r = run("kit de skin care sem limpeza")
        self.assertTrue(r["kits"])
        for k in r["kits"]:
            self.assertNotIn("limpeza", [i["step"] for i in k["items"]])

    def test_25_dor_de_cabeca_sem_dipirona_nem_em_combinacao(self):
        r = run("remedios para dor de cabeça sem ser dipirona")
        self.assertTrue(r["products"])
        self.assertFalse(any("dipirona" in p["ingredients"] or "dipirona" in norm(p["name"]) for p in r["products"]))
        self.assertTrue(r["reply"].startswith("Sem dipirona"))

    def test_ajuste_na_conversa(self):
        first = run("kit de skin care")
        r = run("tira o gel de limpeza", first["context"])
        self.assertEqual(r["intent"]["primaryGoal"], "skincare_basico")
        for k in r["kits"]:
            self.assertNotIn("gel de limpeza", [norm(i["product"]["productType"]) for i in k["items"]])


if __name__ == "__main__":
    unittest.main()
