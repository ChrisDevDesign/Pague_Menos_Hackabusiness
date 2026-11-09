# Ranking: treino x teste

Pesos calibrados no treino: {'bm25': 0.0, 'emb': 0.667, 'graph': 0.333}

| Configuração | nDCG@10 treino | P@5 treino | nDCG@10 teste | P@5 teste |
|---|---|---|---|---|
| somente BM25 | 0.478 | 0.4444 | 0.6653 | 0.6267 |
| somente vetores | 0.9142 | 0.8556 | 0.9696 | 0.88 |
| somente grafo | 0.9472 | 0.9 | 0.9043 | 0.84 |
| híbrido (pesos iniciais) | 0.9454 | 0.8889 | 1.0 | 0.92 |
| híbrido calibrado no treino | 0.9654 | 0.9111 | 1.0 | 0.92 |

Treino: 18 frases. Teste: 15 frases, nunca usadas na calibração.
