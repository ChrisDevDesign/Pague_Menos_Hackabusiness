"""#26 (auditoria 08/11), caminho 2: redator. A DeepSeek reescreve a resposta dos kits em tom de conversa.

O motor continua decidindo tudo (kits, preços, estoque, segurança). O redator recebe só uma FICHA DE FATOS montada
pelo motor (objetivo, kits, preços, loja, o que foi tirado) e nunca a frase da pessoa. Antes de mostrar, a resposta
passa por uma checagem; se falhar, demorar ou a API estiver fora, vale o texto fixo do motor.

Nunca roda para remédio, urgência ou quando não há kit: nesses casos o texto fixo é o que garante, com teste, que
nenhuma resposta traz termo de saúde (doc 14 e doc 15).
"""
from __future__ import annotations

import json
import re

SYSTEM = """Você reescreve a mensagem de um assistente de compras da farmácia Pague Menos para soar como uma conversa
gentil e tranquila, em português do Brasil. Responda SÓ com JSON: {"texto": "..."}.

Regras:
1. Use apenas os fatos recebidos. Não invente produto, marca, preço, desconto, prazo ou benefício.
2. Preço só como está nos fatos (ex.: "R$ 44,62"). Não some nem arredonde.
3. Não fale de saúde, doença, sintoma, dose, tratamento médico, receita ou profissional de saúde.
4. No máximo 2 frases e 260 caracteres. Sem emoji, sem listas, sem travessão.
5. Pode terminar com uma pergunta curta oferecendo ajustar o kit ou ver o total com entrega."""

_PRICE = re.compile(r"R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}")
_FORBIDDEN = re.compile(
    r"\b(m[eé]dic\w*|doen[cç]\w*|diagn[oó]s\w*|sintom\w*|dose\w*|posologia|receita\w*|rem[eé]dio\w*|medicament\w*|"
    r"consult\w*|farmac[eê]utic\w*|cura\w*|tratar\b|garant\w*|100%|gr[aá]tis|desconto extra)\b", re.I)
MAX_LEN = 280


def facts_of(res: dict, goal_label: str, store_name: str | None) -> dict:
    """Ficha de fatos: só o que o motor decidiu. Nada da frase original."""
    kits = [{"faixa": {"economico": "Econômico", "essencial": "Essencial", "completo": "Completo"}.get(k["tier"], k["tier"]),
             "total": _money(k["totalCents"]), "itens": [i["product"]["name"] for i in k["items"]]} for k in res.get("kits", [])]
    intent = res.get("intent") or {}
    f = {"objetivo": goal_label, "kits": kits, "mensagem_original": res.get("reply", "")}
    if intent.get("budgetCents") is not None:
        f["orcamento"] = _money(intent["budgetCents"])
    if store_name:
        f["loja"] = store_name
    if intent.get("exclude"):
        f["sem"] = list(intent["exclude"])
    if intent.get("skinType"):
        f["pele"] = intent["skinType"]
    return f


def check(text: str, facts: dict) -> str | None:
    """Devolve o motivo da recusa, ou None se o texto pode ir para a tela."""
    if not text or not text.strip():
        return "vazio"
    if len(text) > MAX_LEN:
        return "longo"
    if "—" in text:
        return "travessao"
    if _FORBIDDEN.search(text):
        return "termo_proibido"
    allowed = {k["total"] for k in facts.get("kits", [])} | ({facts["orcamento"]} if facts.get("orcamento") else set())
    allowed |= set(_PRICE.findall(facts.get("mensagem_original", "")))
    for p in _PRICE.findall(text):
        if p.replace("R$ ", "R$").replace("R$", "R$ ") not in {a.replace("R$ ", "R$").replace("R$", "R$ ") for a in allowed}:
            return "preco_inventado"
    return None


class Writer:
    def __init__(self, client):
        self.client = client
        self.calls = self.used = self.rejected = 0
        self.last_reason: str | None = None

    def rewrite(self, facts: dict) -> str | None:
        self.calls += 1
        raw = self.client.complete(SYSTEM, json.dumps(facts, ensure_ascii=False))
        if raw is None:
            self.last_reason = "sem_resposta"
            return None
        try:
            text = str(json.loads(raw).get("texto", "")).strip()
        except (ValueError, AttributeError):
            self.last_reason = "formato"
            self.rejected += 1
            return None
        reason = check(text, facts)
        if reason:
            self.last_reason = reason
            self.rejected += 1
            return None
        self.used += 1
        return text

    def status(self) -> dict:
        return {"calls": self.calls, "used": self.used, "rejected": self.rejected, "lastReason": self.last_reason}


def _money(c: int) -> str:
    s = f"{c / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"
