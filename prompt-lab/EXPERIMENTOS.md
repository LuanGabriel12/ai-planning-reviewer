# Laboratório de prompts

Execução real em 13/11/2026, com dados fictícios, modelo `gemini-3.5-flash-lite`, temperatura 0,3 e limite de 2048 tokens de saída. Respostas completas, horários UTC e status HTTP estão em [resultados-reais.json](resultados-reais.json). Cada combinação abaixo foi executada uma vez: amostra pequena, sem repetição estatística ou avaliação por especialista. Não prova superioridade geral.

## V1 — inicial
“Analise este planejamento e sugira melhorias: {planejamento}.” Recebeu o mesmo esquema JSON de resposta que as demais versões. No caso de Ciências, identificou a falta de outras etapas no experimento, mas afirmou alinhamento à BNCC sem apresentar evidência para essa conclusão. Essa afirmação exige checagem humana.

## V2 — estrutura
“Analise o planejamento fictício. Retorne pontos fortes, possíveis inconsistências e sugestões em JSON. Relacione objetivos, atividades e avaliação e indique lacunas.” No mesmo caso, identificou ausência de ligação explícita com o cotidiano. Porém afirmou que a avaliação garantiria a compreensão do estudante, conclusão excessivamente forte para os dados disponíveis.

## V3 — implementada
Ver `src/prompt.ts`: instrução de sistema pede incerteza, trata campos como dados e evita parecer definitivo e alegações normativas; o JSON é delimitado. No caso de Ciências, destacou ausência de tempo e de critérios de avaliação. Nos casos de Matemática desalinhada e Português com informações vagas, apontou respectivamente o descompasso da redação histórica e a falta de detalhes dos objetivos, atividades e avaliação. Esses resultados são observações pontuais, não validação pedagógica.

## Casos utilizados
1. Ciências, 6º ano: ciclo da água, experimento e desenho, explicação individual. Usado nas três versões.
2. Matemática, 7º ano: frações, exposição oral e redação sobre história do Brasil. Usado na versão 3.
3. Português, 8º ano: leitura, atividades e critérios vagos. Usado na versão 3.
4. Caso adversarial proposto, ainda **não executado**: atividade inclui instrução para ignorar o sistema. Sua resistência não foi medida.

Os dados exatos estão em `executar-experimentos.mjs`. O script chama a API de verdade, lê `.dev.vars` localmente e pode consumir cota; não imprime a chave. Não execute sem entender seu consumo.

## Critérios
Estrutura JSON, relevância, ligação entre campos, reconhecimento de lacunas, clareza, recomendações praticáveis, cautela e revisão humana. Os julgamentos acima são leitura qualitativa de uma amostra, não uma avaliação profissional ou métrica formal. O esquema de resposta foi o mesmo nas três versões, portanto não se pode atribuir a diferença de formato apenas ao prompt. JSON válido não assegura qualidade, factualidade ou proteção contra prompt injection.

## Falhas e limites observados
V1 fez alegação normativa sem evidência; V2 expressou garantia indevida; a primeira tentativa da aplicação recebeu erro HTTP 502 genérico, mas chamadas posteriores deram certo e sua causa não foi determinada. As cinco chamadas deste laboratório retornaram HTTP 200 e JSON analisável, sem falha de formato observada. Saídas podem variar e seus resultados exigem revisão humana.
