"""#24 (auditoria 08/11): o que a pessoa pede para TIRAR que não é ingrediente ("sem gel de limpeza", "sem limpeza").

Ingrediente e princípio ativo ("sem dipirona", "sem retinol") já são tratados em nlu.py (`excluded_ingredients`).
Aqui ficam tipo de produto, etapa inteira e parte do nome/marca. A palavra depois do "sem" é comparada com o
catálogo nesta ordem: tipo de produto citado -> etapa -> tipos que contêm a palavra -> nome ou marca.
Preferências ("sem fragrância") e o resto da frase ("sem gastar muito") não entram. Mesma regra do app
(app/src/services/mock/exclusions.ts).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .text import norm

_CUE = re.compile(r"\b(sem ser|sem|tirando|tira|tirar|retira|exceto|menos|nao quero|nada de|que nao seja|nao pode ser|alergia a|alergico a|alergica a)\s+")
_ARTICLE = re.compile(r"^(o|a|os|as|de|do|da|dos|das|um|uma|nenhum|nenhuma)\s+")
_STOP = re.compile(r"\s(e|ou|mas|para|pra|com|ate|que|porque|pois|por|no|na|so)\s|[,.;!?]")
_SKIP = re.compile(r"^(fragrancia|perfume|alcool|oleo\b|parabeno|sulfato|gluten|lactose|acucar|gastar|pagar|frete|receita|demora|pressa|nada\b)")
STEP_WORDS: list[tuple[str, str]] = [
    ("limpeza", "limpeza"), ("limpar", "limpeza"),
    ("hidratacao", "hidratacao"), ("hidratante", "hidratacao"),
    ("protetor solar", "protecao_solar"), ("protecao solar", "protecao_solar"), ("filtro solar", "protecao_solar"), ("protetor", "protecao_solar"),
    ("tonico", "preparo"), ("esfoliante", "preparo"), ("esfoliacao", "preparo"), ("mascara", "preparo"),
    ("serum", "tratamento"), ("tratamento", "tratamento"),
]


@dataclass
class Exclusions:
    types: list[str] = field(default_factory=list)
    steps: list[str] = field(default_factory=list)
    names: list[str] = field(default_factory=list)
    labels: list[str] = field(default_factory=list)
    stripped: str = ""

    def __bool__(self) -> bool:
        return bool(self.labels)


class ExclusionReader:
    def __init__(self, cat):
        self.types = sorted({norm(p["productType"]) for p in cat.products}, key=len, reverse=True)
        self.names = [norm(f'{p["name"]} {p["brand"]}') for p in cat.products]
        self.ingredient_names = {norm(i["name"]) for i in cat.ingredients.values() if len(i.get("name", "")) >= 4}

    def read(self, text: str) -> Exclusions:
        q = f" {norm(text)} "
        out = Exclusions()
        cut: list[tuple[int, int]] = []

        def add(kind: str, value: str, label: str):
            lst = getattr(out, kind)
            if value not in lst:
                lst.append(value)
            if label not in out.labels:
                out.labels.append(label)

        for m in _CUE.finditer(q):
            rest = q[m.end():]
            stop = _STOP.search(rest)
            if stop:
                rest = rest[:stop.start()]
            x = " ".join(rest.split()[:5])
            while _ARTICLE.match(x):
                x = _ARTICLE.sub("", x, count=1)
            if len(x) < 3 or _SKIP.match(x):
                continue
            # ingrediente fica com o nlu.py (que já sabe negar ingrediente); aqui não corta o trecho
            px = f" {x} "
            if any(f" {i} " in px or f" {i} ".startswith(px) or f" {x.split()[0]} " in f" {i} " for i in self.ingredient_names):
                continue
            span = (m.start(), m.end() + rest.find(x) + len(x))
            padded = f" {x} "
            t = next((t for t in self.types if f" {t} " in padded), None)
            if t:
                add("types", t, t); cut.append(span); continue
            st = next((s for w, s in STEP_WORDS if x == w or x.startswith(w + " ")), None)
            if st:
                add("steps", st, next(w for w, s in STEP_WORDS if s == st and (x == w or x.startswith(w + " ")))); cut.append(span); continue
            many = [t for t in self.types if len(x) >= 4 and x in t]
            if many:
                for t in many:
                    add("types", t, x)
                cut.append(span); continue
            if len(x) >= 4 and any(x in n for n in self.names):
                add("names", x, x); cut.append(span)
        s = q
        for a, b in sorted(cut, reverse=True):
            s = s[:a] + " " + s[b:]
        out.stripped = " ".join(s.split())
        return out

    def from_labels(self, labels) -> Exclusions:
        """Reconstrói a partir dos rótulos guardados no intent (vão e voltam pela conversa)."""
        return self.read(", ".join(f"sem {l}" for l in labels)) if labels else Exclusions()


def excluded(p: dict, ex: Exclusions | None) -> bool:
    if not ex:
        return False
    if norm(p["productType"]) in ex.types:
        return True
    hay = norm(f'{p["name"]} {p["brand"]}')
    return any(n in hay for n in ex.names)
