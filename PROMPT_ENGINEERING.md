# Experimento de prompts

Quis observar como instruções diferentes afetam a análise de planejamentos fictícios. Defini previamente seis critérios: formato, clareza, utilidade, identificação de lacunas, ausência de invenções e consistência com o planejamento. A análise abaixo é qualitativa, feita sobre uma amostra pequena e sem revisão de especialista.

## Método

Em 13/11/2026, confirmei que a chave estava no nível gratuito no Google AI Studio e usei `gemini-3.5-flash-lite`, temperatura 0,3, mesmo JSON Schema e limite de 2048 tokens. Executei uma vez cada combinação de três versões com dois exemplos: A, plano de Ciências relativamente detalhado; B, plano de Matemática com objetivos vagos, avaliação insuficiente e lacunas. O esquema igual nas três versões controla a estrutura, mas impede atribuir a aderência de formato exclusivamente ao prompt. Cada resposta também foi validada com Zod.

- **V1 básica:** solicita análise e sugestões.
- **V2 estruturada:** pede comparação entre objetivos, atividades e avaliação, identificação de lacunas e proíbe aprovação/reprovação.
- **V3 aprimorada:** além da tarefa, usa instrução de sistema para tratar os campos como dados, reconhecer incertezas, evitar invenções e afirmações normativas e preservar revisão humana. É a versão usada pela aplicação.

Os prompts exatos e exemplos estão em [executar-matriz.mjs](prompt-lab/executar-matriz.mjs); os resultados e tempos registrados estão em [matriz-2026-11-13.json](prompt-lab/matriz-2026-11-13.json). O script realiza chamadas reais e só deve ser executado após confirmar o nível gratuito; pode consumir cota. A indicação manual do plano no script não é uma garantia técnica de gratuidade.

## Resultados observados

| Versão | Exemplo | HTTP / JSON | Latência | Leitura qualitativa |
|---|---|---|---|---|
| V1 | A | 200 / válido | 1.793 ms | Sugestões claras; aponta tempo ausente, mas afirma ser importante tampar o recipiente sem fundamentar essa necessidade. |
| V1 | B | 200 / válido | 1.413 ms | Identifica objetivos, atividade e avaliação vagos; propõe conteúdos específicos e cita BNCC, que exigem revisão pedagógica. |
| V2 | A | 200 / válido | 1.466 ms | Relaciona campos e propõe observar condensação; supõe um detalhe de tampa/superfície que o plano não descreve. |
| V2 | B | 200 / válido | 1.147 ms | Identifica lacunas e sugere rubrica; traz afirmação de avaliação formativa e recomendação normativa que merecem conferência. |
| V3 | A | 200 / válido | 1.236 ms | Aponta tempo e materiais, com sugestões objetivas; a afirmação de visualização direta da evaporação pode ser tecnicamente imprecisa. |
| V3 | B | 200 / válido | 6.564 ms | Identifica a vagueza dos objetivos e da atividade e a falta de critérios; as sugestões seguem esses problemas, embora sejam amplas. |

As sugestões são compreensíveis e em geral ligadas aos exemplos, porém podem ser genéricas ou introduzir suposições. Todas as seis respostas respeitaram o formato; isso não valida seu conteúdo. Para este MVP mantive a V3 por sua instrução mais cuidadosa e pelo comportamento observado no exemplo B, sem afirmar que seja universalmente superior.

Uma matriz maior, repetições, avaliação independente e testes adversariais seriam necessários para conclusões mais fortes. Instruções maliciosas são tratadas como dados no prompt e há teste local dessa construção, mas **não foi feita chamada adversarial real** nesta missão.

## Experimento anterior

Uma rodada anterior, separada desta matriz, está em [resultados-reais.json](prompt-lab/resultados-reais.json). Ela não faz parte das seis novas chamadas. Naquela amostra, V1 alegou alinhamento à BNCC sem evidência e V2 expressou garantia indevida de compreensão.
