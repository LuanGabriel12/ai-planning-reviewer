# Relatório final de entrega

## Ponto de partida
O projeto já possuía frontend React, Pages Function, chave local ignorada pelo Git, testes com mocks e uma chamada real registrada em sessão anterior. A comparação anterior de prompts não era a matriz 3 × 2 pedida nesta missão.

## Trabalho realizado
- Mantive o modelo e a arquitetura, melhorei mensagens, limites do corpo de resposta, bloqueio da função hospedada e comportamento durante carregamento. Ajustei mínimos para aceitar nomes curtos de disciplina e ano.
- Preparei um verificador Turnstile isolado com mocks; ele não está integrado à aplicação. Ainda não há rate limit distribuído, teto global de chamadas ou autenticação de produção ativa.
- Ampliei a suíte e revisei desktop, viewport mobile e navegação inicial por teclado. Produzi capturas reais em `docs/imagens/`.
- Reescrevi o README em primeira pessoa, explicando a assistência do Codex, os limites do projeto e a distinção do sistema anterior assistido pelo Cursor.
- Executei seis chamadas reais de prompt e uma para verificar a interface completa: **7 novas chamadas**, após confirmar nível gratuito, sem ativar faturamento. Todas as seis da matriz retornaram HTTP 200 e JSON validado. As latências e respostas estão em `prompt-lab/matriz-2026-11-13.json`. A V3 foi mantida como escolha provisória pela clareza das restrições e resposta ao exemplo B; a amostra é insuficiente para provar superioridade.
- Instalação limpa, TypeScript, build, compilação Pages e auditoria passaram; 24 testes passaram. A primeira instalação limpa falhou porque o servidor segurava um executável; passou ao encerrá-lo. Dois avisos de comentários Zod ocorreram no build.
- Não encontrei a chave na verificação dos arquivos preparados e build; isso não é garantia absoluta. O endpoint público continua bloqueado no código.

## Pendências
A segurança para acesso hospedado exige autenticação, integração e validação real do Turnstile, limites distribuídos e duráveis de taxa e orçamento, proteção de previews e testes negativos. Nenhuma publicação pública ou deploy foi feita. Não há avaliação de especialista pedagógico, teste real adversarial ou avaliação estatística.

## Preparação para entrevista
Explique o caminho navegador → Function → Gemini → validação Zod → interface; diferenças entre prompt e esquema; por que JSON válido não garante veracidade; o uso de mocks e o que as sete chamadas reais comprovam; os limites contra prompt injection e abuso; e seu uso do Codex. Evite afirmar experiência profissional ou impacto em escola.

## Formulário GenAI
O repositório pode servir como evidência de desenvolvimento assistido por IA, integração real de API de LLM, experimentação exploratória de prompts, validação de JSON e testes. As alternativas exatas do formulário devem ser conferidas no próprio formulário; elas não foram verificadas nesta missão.
