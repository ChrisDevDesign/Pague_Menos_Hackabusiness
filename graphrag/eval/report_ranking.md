# Ranking: treino x teste

Pesos calibrados no treino: {'bm25': 0.0, 'emb': 0.571, 'graph': 0.429}

| Configuração | nDCG@10 treino | P@5 treino | nDCG@10 teste | P@5 teste |
|---|---|---|---|---|
| somente BM25 | 0.4426 | 0.4111 | 0.6434 | 0.5333 |
| somente vetores | 0.9246 | 0.8556 | 0.9759 | 0.8667 |
| somente grafo | 0.9602 | 0.9 | 0.8906 | 0.8 |
| híbrido (pesos iniciais) | 0.9447 | 0.8778 | 1.0 | 0.9067 |
| híbrido calibrado no treino | 0.9706 | 0.8889 | 1.0 | 0.9067 |

Treino: 18 frases. Teste: 15 frases, nunca usadas na calibração.
