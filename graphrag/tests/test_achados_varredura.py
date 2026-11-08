"""#50 a #59 (auditoria 08/11): achados da varredura de bugs. Cada teste usa a frase que mostrou o problema."""
import unittest

from graphrag.composer import CORE_TYPES, pref_ok
from graphrag.dialogue import Engine
from graphrag.safety import attention

GRAPH = Engine.build()


def eng():
    return Engine(GRAPH.cat, GRAPH.graph, GRAPH.wv, GRAPH.clf)


def run(e, q, ctx=None):
    return e.search({"query": q, "storeId": None, "context": ctx, "allowExternal": True})


def names(r):
    return [it["product"]["name"] for k in r["kits"] for it in k["items"]]


class TestAchados(unittest.TestCase):
    def test_50_kit_de_higiene_tem_sabonete_shampoo_e_creme_dental(self):
        r = run(eng(), "kit de higiene pra viagem")
        self.assertEqual(len(r["kits"]), 3)
        for k in r["kits"]:
            for it in k["items"]:
                step, kind = it["step"], it["product"]["productType"].lower()
                if step in CORE_TYPES:
                    self.assertTrue(kind.startswith(CORE_TYPES[step]), (step, it["product"]["name"]))

    def test_51_tira_o_protetor_ajusta_o_kit(self):
        e = eng()
        r = run(e, "kit de skin care")
        r = run(e, "minha pele é oleosa", r["context"])
        r = run(e, "tira o protetor", r["context"])
        self.assertEqual(r["act"], "refinar")
        self.assertEqual(r["intent"]["primaryGoal"], "skincare_basico")
        self.assertTrue(r["kits"])
        for k in r["kits"]:
            self.assertFalse(any(it["step"] == "protecao_solar" for it in k["items"]))

    def test_52_febre_persistente_orienta_e_mantem_a_lista(self):
        r = run(eng(), "estou com febre alta há 3 dias")
        self.assertEqual(r["safety"]["decision"], "caution")
        self.assertEqual(r["safety"]["category"], "procure_atendimento")
        self.assertTrue(r["safety"]["message"].startswith("Febre alta"))
        self.assertNotIn("Febre alta", r["reply"])          # sem repetir: o app mostra a orientação no quadro de atenção
        self.assertTrue(r["products"])
        self.assertIsNone(attention("estou com febre"))
        self.assertIsNotNone(attention("febre que nao baixa"))

    def test_53_alergia_a_ingrediente_e_exclusao_nao_sintoma(self):
        r = run(eng(), "tenho alergia a niacinamida, quero kit pra acne")
        self.assertEqual(r["intent"]["primaryGoal"], "acne")
        self.assertTrue(r["kits"])
        for k in r["kits"]:
            for it in k["items"]:
                self.assertNotIn("niacinamida", it["product"]["ingredients"])
        r = run(eng(), "tenho alergia a poeira")            # alergia de verdade continua sendo o sintoma
        self.assertIn("alergia", r["reply"].lower())

    def test_54_remedio_pra_pressao_lista_os_de_pressao(self):
        r = run(eng(), "remédio pra pressão")
        self.assertTrue(r["products"])
        for p in r["products"]:
            self.assertTrue((p.get("equivalence") or {}).get("group", "").startswith("tensivalol"), p["name"])

    def test_55_selo_sem_fragrancia_corrigido(self):
        by = {p["id"]: p for p in GRAPH.cat.products}
        for pid in ("p243", "p279", "p281"):
            self.assertNotIn("sem fragrância", by[pid]["claims"])

    def test_56_sem_acucar_nao_trava_capsula(self):
        e = eng()
        r = run(e, "kit de suplementos")
        r = run(e, "sem açúcar", r["context"])
        self.assertTrue(r["kits"])
        for k in r["kits"]:
            for it in k["items"]:
                self.assertTrue(pref_ok(it["product"], "sem açúcar"), it["product"]["name"])

    def test_57_lista_do_refino_fica_no_objetivo(self):
        e = eng()
        r = run(e, "kit para acne")
        r = run(e, "sem fragrância", r["context"])
        steps = set(GRAPH.cat.goal_by_id["acne"]["required_steps"] + GRAPH.cat.goal_by_id["acne"]["optional_steps"])
        for p in r["products"]:
            self.assertTrue(set(p["coversSteps"]) & steps, p["name"])

    def test_58_kit_masculino_vira_skin_care(self):
        r = run(eng(), "kit masculino")
        self.assertEqual(r["intent"]["primaryGoal"], "skincare_basico")
        self.assertTrue(r["kits"])

    def test_59_rotulos_e_leituras(self):
        self.assertEqual(GRAPH.cat.goal_by_id["higiene_premium"]["label"], "Higiene do dia a dia")
        r = run(eng(), "presente pra minha mãe")
        self.assertIn("presente", r["reply"].lower())
        self.assertFalse(r["products"])
        r = run(eng(), "pele ressecada e repuxando depois do banho")
        self.assertEqual(r["intent"]["skinType"], "seca")
        r = run(eng(), "vitamina c")
        self.assertIn("Vitamina C suplemento", r["suggestions"])


if __name__ == "__main__":
    unittest.main()
