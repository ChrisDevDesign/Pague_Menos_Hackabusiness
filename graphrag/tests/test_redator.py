"""#26 (auditoria 08/11): redator dos kits. Cliente falso, sem rede: o texto só vai para a tela se passar na checagem."""
import json
import unittest

from graphrag.dialogue import Engine
from graphrag.writer import check

GRAPH = Engine.build()


class Fake:
    def __init__(self, texto=None, raw=None):
        self.texto, self.raw, self.sent = texto, raw, []

    def complete(self, system, user):
        self.sent.append((system, user))
        if self.raw is not None:
            return self.raw
        if "objetivo" in user:          # chamada do redator (ficha de fatos)
            return json.dumps({"texto": self.texto}) if self.texto is not None else None
        return json.dumps({"objetivos": [], "preocupacoes": [], "ingredientes": [], "etapas": [], "evitar": [], "preferencias": [],
                           "orcamento_centavos": None, "pele": None,
                           "ajuste": {"evitar": [], "preferencias": [], "orcamento": None, "pele": None}})


def eng(fake, writer=True):
    return Engine(GRAPH.cat, GRAPH.graph, GRAPH.wv, GRAPH.clf, llm=fake, writer=writer)


def search(e, q):
    return e.search({"query": q, "storeId": None, "context": None, "allowExternal": True})


class TestRedator(unittest.TestCase):
    def test_texto_bom_com_preco_dos_fatos_vai_para_a_tela(self):
        base = search(Engine(GRAPH.cat, GRAPH.graph, GRAPH.wv, GRAPH.clf), "kit de skin care")
        price = base["reply"].split("R$ ")[1].split()[0].rstrip(",.")
        fake = Fake(texto=f"Separei três caminhos para cuidar da sua pele; o mais em conta sai por R$ {price}. Quer ajustar algum item?")
        r = search(eng(fake), "kit de skin care")
        self.assertEqual(r.get("replySource"), "redator")
        self.assertIn(price, r["reply"])

    def test_preco_inventado_volta_para_o_texto_fixo(self):
        fake = Fake(texto="Montei kits a partir de R$ 9,99 para você.")
        r = search(eng(fake), "kit de skin care")
        self.assertNotEqual(r.get("replySource"), "redator")
        self.assertNotIn("9,99", r["reply"])

    def test_termo_de_saude_e_recusado(self):
        fake = Fake(texto="Esses kits tratam a acne; consulte um dermatologista.")
        r = search(eng(fake), "kit para acne")
        self.assertNotEqual(r.get("replySource"), "redator")

    def test_api_fora_mantem_o_texto_fixo(self):
        r = search(eng(Fake(texto=None)), "kit de skin care")
        self.assertNotEqual(r.get("replySource"), "redator")
        self.assertTrue(r["reply"])

    def test_nunca_para_remedio_nem_envia_a_frase_da_pessoa(self):
        fake = Fake(texto="Qualquer coisa.")
        search(eng(fake), "remédio para dor de cabeça")
        self.assertFalse([u for _, u in fake.sent if "objetivo" in u])            # sem kit de remédio, sem redator
        search(eng(fake), "minha pele é oleosa, kit até 150 reais, meu nome é Joana")
        for _, u in fake.sent:
            if "objetivo" in u:
                self.assertNotIn("Joana", u)
                self.assertNotIn("meu nome", u)

    def test_desligado_por_padrao(self):
        fake = Fake(texto="Qualquer coisa.")
        search(eng(fake, writer=None), "kit de skin care")
        self.assertFalse([u for _, u in fake.sent if "objetivo" in u])

    def test_checagem(self):
        facts = {"kits": [{"total": "R$ 44,62"}], "mensagem_original": "R$ 44,62"}
        self.assertIsNone(check("O kit sai por R$ 44,62.", facts))
        self.assertEqual(check("Sai por R$ 10,00.", facts), "preco_inventado")
        self.assertEqual(check("x" * 400, facts), "longo")
        self.assertEqual(check("Bom para a pele — confira.", facts), "travessao")


if __name__ == "__main__":
    unittest.main()
