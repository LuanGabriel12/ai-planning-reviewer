# Relatório final — multiagente

O protótipo anterior foi ampliado com dois papéis distintos de Gemini (analista e revisor crítico), um orquestrador determinístico e uma ferramenta local acionada por function calling. O orquestrador faz decisão entre consolidar, revisar uma vez ou exibir ressalvas; a versão revisada não é reavaliada. A interface mostra etapas operacionais sem expor pensamentos internos.

Foram feitas entre 7 e 8 chamadas reais nesta missão, sempre sequenciais e dentro do teto de 12: uma análise individual, duas tentativas multiagente que falharam na validação e um fluxo concluído em três chamadas. A segunda tentativa não registrou sua etapa exata, impedindo contagem exata; foi usado o limite superior. O plano da chave foi conferido como gratuito e nenhum faturamento foi ativado. O fluxo concluído usou a ferramenta, mas ainda apresentou uma suposição e uma ambiguidade não sinalizadas pelo revisor. Isso não demonstra superioridade. Registros completos em `EXPERIMENTOS_AGENTES.md`.

A instalação limpa, TypeScript, build, 45 testes, compilação da Pages Function e auditoria npm passaram; Rollup emitiu dois avisos de comentários Zod. Testes com mocks cobrem decisões, ferramenta, cancelamento, timeout, falhas e validação. Os ramos de revisão adicional e prompt injection ainda não foram testados com o modelo real.

A auditoria de credenciais e histórico é descrita em `RELATORIO_SEGURANCA_PUBLICACAO.md`. O endpoint hospedado segue bloqueado; não há deploy. Antes de acesso público funcional, implementar controles distribuídos de taxa/custo, autenticação e Turnstile integrado.

Para entrevista: explicar o limite de quatro chamadas, por que o modelo pediu a ferramenta no modo obrigatório, como o ID e a assinatura retornam à API, como o revisor influencia o fluxo, a diferença entre JSON válido e conteúdo correto, e as falhas reais observadas. Não afirmar experiência com Claude ou GPT baseada neste projeto.

Na descrição oficial da vaga do iFood, a alternativa agrupa engenharia de prompts avançada e orquestração de agentes. A experiência com Gemini, papéis distintos, function calling real e decisões do coordenador é demonstrável em pequena escala; o nível “avançado” é subjetivo e a avaliação sem revisão independente permanece limitada. A classificação criteriosa é **parcialmente comprovado** para a alternativa como um todo. Não há evidência neste projeto de uso de Claude ou GPT, automações n8n/Make/Zapier ou impacto de negócio mensurável.
