# Experimento: agente único e multiagente

## Critérios definidos antes da comparação

Formato válido; sugestões compreensíveis e úteis; reconhecimento de lacunas; fidelidade aos dados; distinção entre fato e inferência; e clareza das limitações. A leitura é qualitativa, não avaliação pedagógica independente.

## Condições e evidências

Em 13/11/2026 usei o mesmo planejamento fictício de Ciências e o modelo `gemini-3.5-flash-lite`. O Google AI Studio identificou a chave como nível gratuito. A página de limites mostrou 15 requisições/minuto, 250 mil tokens de entrada/minuto e 500 requisições/dia para o projeto naquele momento; o painel apresenta máximos históricos, não uma garantia de capacidade disponível. Consultei a [tabela de preços](https://ai.google.dev/gemini-api/docs/pricing): entrada e saída são gratuitas no nível gratuito para esse modelo, sujeitas à disponibilidade e limites. Não ativei cobrança.

- [Agente único: resposta real](prompt-lab/comparacao-agente-unico.json): uma chamada, HTTP 200. Apontou ausência de tempo/recursos e critérios específicos, e sugeriu rubrica e conexão com o cotidiano.
- [Multiagente: resultado e etapas reais](prompt-lab/experimento-multi-real.json): o modelo solicitou a ferramenta local; o servidor a executou e devolveu o resultado; o analista gerou JSON; o revisor analisou em outra chamada; o orquestrador consolidou. O fluxo bem-sucedido registrou 3 chamadas. A [captura](docs/imagens/05-multiagente-real.jpg) mostra a interface e o caminho operacional.

## Comparação e falhas

Ambos destacaram critérios de avaliação pouco detalhados e sugeriram uma rubrica. O agente único também destacou a ligação ao cotidiano. O multiagente separou fatos informados e inferências, mas incluiu a suposição de que havia recursos na escola. A resposta disse que a avaliação combinava desenhos em grupo com explicação individual; o texto fornecido não descreve claramente essa parte como avaliação em grupo. Apesar dessas ressalvas, o revisor escolheu consolidar. Portanto, o revisor não substitui checagem humana e essa execução não prova que a abordagem multiagente seja melhor.

Duas tentativas multiagente anteriores não chegaram a resultado: a primeira passou pela ferramenta e falhou na etapa de análise; a segunda também terminou com erro de validação. O primeiro esquema não limitava no pedido ao modelo todos os tamanhos depois exigidos pelo Zod. O esquema foi alinhado aos limites e uma tentativa posterior passou, mas não é possível estabelecer com certeza a causa de cada falha. O registro das tentativas não preservou a etapa exata da segunda falha; por isso, o total desta missão é **entre 7 e 8 chamadas** (1 agente único, 2 na primeira falha, 1–2 na segunda e 3 no fluxo concluído), abaixo do teto de 12. Não houve chamadas paralelas.

O único caso comparado e uma execução concluída de cada modo não permitem medir superioridade. O ramo de revisão adicional, falhas do revisor, timeout e instrução maliciosa foram verificados com mocks, não com uma chamada real. Não foi realizado teste real adversarial nesta missão.

Para reproduzir, confirme primeiro plano e cotas no AI Studio, siga o README, use o mesmo exemplo e execute uma vez em cada modo. Cada execução multiagente pode fazer até 4 chamadas. Não envie dados reais. As saídas variam entre execuções.
