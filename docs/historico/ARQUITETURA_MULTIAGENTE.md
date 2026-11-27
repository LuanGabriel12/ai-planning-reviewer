# Arquitetura multiagente

O modo opcional utiliza dois papéis de LLM e um orquestrador determinístico; não são três modelos diferentes. Ambos os papéis usam Gemini 3.5 Flash-Lite com instruções próprias. O sistema é um protótipo local, não um serviço em produção.

1. A Pages Function valida origem, tipo, tamanho e esquema do planejamento. O endpoint hospedado retorna 503 independentemente das variáveis de produção.
2. O analista recebe o planejamento como dado não confiável. Uma primeira chamada usa function calling no modo **ANY**, que obriga o modelo a solicitar a ferramenta disponível. O modelo escolhe o tema entre quatro valores permitidos; isso não é escolha livre sobre se chamar uma ferramenta.
3. O servidor valida nome e argumentos com Zod e executa `consultar_criterio_ficticio`, consulta local de exemplos de perguntas sobre objetivos, atividades, avaliação ou alinhamento. Não acessa rede nem escreve arquivos. A resposta é identificada como exemplo, não norma.
4. A segunda chamada devolve o conteúdo original da chamada do modelo, incluindo eventual assinatura e ID, e o resultado da ferramenta. O analista produz JSON com pontos fortes, inconsistências, sugestões, fatos informados e inferências. Zod valida o resultado.
5. O revisor crítico recebe plano e análise em uma chamada distinta e retorna JSON com decisão, problemas e orientação. Ele não aprova o planejamento.
6. O orquestrador toma uma decisão explícita: `CONSOLIDAR` mostra a análise; `RESSALVAS` mantém advertências; `REVISAR` solicita no máximo uma reescrita ao analista. A reescrita **não é reavaliada** e é identificada como tal. Falha do revisor ou da reescrita preserva a análise com ressalva; falha inicial encerra sem resultado.
7. Eventos operacionais são enviados à interface em NDJSON. São rótulos de etapa, não pensamentos internos. A interface permite cancelamento e mostra o caminho e as ressalvas.

Cada execução usa no máximo quatro chamadas Gemini e uma execução da ferramenta, sequenciais, com timeout de 20 segundos por chamada e 75 segundos para o fluxo. Não há tentativas automáticas. O botão de cancelar interrompe a requisição do navegador e solicita cancelamento ao servidor; não garante que uma requisição já recebida pelo provedor deixe de consumir cota. Cabeçalhos e saídas têm limites, e não há URLs arbitrárias ou ferramentas externas autorizadas pelo modelo.

A proteção por prompts e um revisor LLM não garantem veracidade, segurança contra prompt injection ou correção pedagógica. Dados reais não devem ser enviados. Saídas da ferramenta e avaliações do revisor são validadas estruturalmente, não verificadas por especialista.

Referências: [Function calling GenerateContent](https://ai.google.dev/gemini-api/docs/generate-content/function-calling), [formato FunctionResponse](https://ai.google.dev/api/generate-content), [modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).
