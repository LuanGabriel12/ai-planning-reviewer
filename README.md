# AI Planning Reviewer

Criei este projeto para experimentar a integração de um modelo de linguagem em uma aplicação web. Sou estudante de Inteligência Artificial e Machine Learning, e quis desenvolver um assistente que analisa **planejamentos pedagógicos fictícios** e sugere pontos de reflexão para uma pessoa educadora.

Desenvolvi o projeto com assistência do Codex: usei a ferramenta para apoiar implementação, testes e documentação. Um sistema pedagógico anterior, independente, foi feito com assistência do Cursor e serviu de referência de domínio. Este repositório não é aquele sistema e não foi desenvolvido com Cursor.

> O resultado é uma sugestão gerada por IA: pode conter erros, não aprova nem reprova um planejamento e não substitui a avaliação de uma pessoa educadora. Use somente dados fictícios, sem informações pessoais ou escolares reais.

## O problema e a solução

Um planejamento pode ter objetivos, atividades e avaliação pouco conectados. O aplicativo recebe esses campos e solicita ao Gemini uma análise com **pontos fortes**, **possíveis inconsistências** e **sugestões de melhoria**. A pessoa pode editar e copiar o texto antes de utilizá-lo. Há estados de carregamento, mensagens de erro e um exemplo fictício.

## Demonstração

1. Preencha disciplina, ano, objetivos, atividades e avaliação, ou clique em **Usar exemplo fictício**.
2. Clique em **Analisar com IA**. A função no servidor consulta o Gemini.
3. Revise, edite e copie o resultado.

![Formulário fictício](docs/imagens/01-formulario.jpg)
![Resultado de uma chamada real](docs/imagens/03-resultado-real.jpg)

Também há capturas de [carregamento](docs/imagens/02-carregamento.jpg) e [mobile](docs/imagens/04-mobile.jpg). O fluxo real foi testado localmente; não há deploy.

## Arquitetura e tecnologias

```text
React + TypeScript + Vite + CSS
    │ POST /api/analyze, mesmo domínio
    ▼
Cloudflare Pages Function → validação Zod → Gemini API REST
    ▲                                      │
    └──────── resposta JSON validada ──────┘
```

A chave é lida no servidor e não é enviada ao frontend. O modelo utilizado nos testes foi `gemini-3.5-flash-lite`, no endpoint `v1beta/models/gemini-3.5-flash-lite:generateContent`. A API é instruída a produzir JSON e o servidor valida a estrutura antes de responder. Isso não garante correção factual nem qualidade pedagógica. A disponibilidade, o plano e os limites dependem da conta.

A aplicação usa React, TypeScript, Vite, Zod e CSS. Os testes usam Vitest, Testing Library e mocks; Wrangler executa a Pages Function localmente. Não implementei Tailwind porque CSS convencional foi suficiente para este MVP.

## Experimento com prompts

Comparei três versões de prompt em dois planejamentos fictícios: seis chamadas reais, com o mesmo modelo, temperatura 0,3 e esquema de saída. Todas retornaram HTTP 200 e passaram no esquema Zod. Antes do lote, confirmei no Google AI Studio que a chave estava no nível gratuito. As respostas completas, latências e critérios estão em [PROMPT_ENGINEERING.md](PROMPT_ENGINEERING.md) e [prompt-lab/matriz-2026-11-13.json](prompt-lab/matriz-2026-11-13.json).

A versão 3 foi a escolha para este protótipo porque explicita limites e tratamento de lacunas, e a resposta do exemplo B apontou os três problemas pretendidos. É uma observação de uma única execução por caso, não prova estatística de superioridade ou avaliação profissional.

## Execução local

Requisitos: Node.js 24.14.0, npm e chave Gemini com acesso ao modelo. Verifique no [Google AI Studio](https://aistudio.google.com/apikey) o plano e as cotas antes de usar; não é preciso ativar faturamento para executar os testes com mocks.

```powershell
npm ci
npm run build
```

Copie `.env.example` para `.dev.vars`, coloque sua chave em `GEMINI_API_KEY` e defina `LOCAL_DEV=true`. Não envie nem versione esse arquivo. Execute:

```powershell
npm run preview:full
```

Acesse http://127.0.0.1:8788. O servidor local não possui controle de acesso nem limite durável de consumo: mantenha-o ligado apenas ao endereço local, sem expô-lo à rede ou por túnel. `npm run dev` serve apenas o frontend Vite, sem a função de API.

## Testes

```powershell
npm ci
npm run typecheck
npm test
npm run build
npx wrangler pages functions build --outfile .wrangler/verification.js
npm audit
```

A suíte automatizada não chama o Gemini e cobre validação, erros, timeout, bloqueio do endpoint hospedado e fluxo de interface com mocks. A matriz de prompts e a captura de resultado foram chamadas reais, separadas da suíte. Consulte [RELATORIO_TESTES.md](RELATORIO_TESTES.md).

## Segurança e limitações

O endpoint hospedado está **bloqueado no código**, inclusive se variáveis de produção forem definidas. O projeto ainda não possui limite de taxa distribuído nem teto global de chamadas ou custos. Antes de habilitar hospedagem é necessário implementar e validar esses controles, autenticação privada, Turnstile no cliente e validação no servidor, além de proteger previews. Há um verificador de Turnstile isolado e testado com mocks, mas ele **não está conectado ao fluxo** e não habilita o serviço.

Há validação de origem, tipos e tamanhos de entrada, limite de resposta do provedor, timeout e erros sem detalhes internos. A instrução de sistema trata o texto recebido como dado não confiável, mas isso não elimina prompt injection. Não há detector confiável de dados pessoais. O Google recebe o texto quando a chamada acontece. Consulte [CLOUDFLARE_DEPLOY_FUTURO.md](CLOUDFLARE_DEPLOY_FUTURO.md).

## Próximos passos

Avaliar mais casos com uma pessoa educadora, testar instruções adversariais sem dados sensíveis, tornar controles de segurança e orçamento verificáveis, proteger ambiente de preview e então revisar uma possível publicação. Nenhum deploy ou publicação pública foi feito.
