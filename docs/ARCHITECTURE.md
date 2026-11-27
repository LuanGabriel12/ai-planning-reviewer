# Arquitetura do Sistema — AI Planning Reviewer V2

## 1. Visão Geral

O **AI Planning Reviewer V2** é um protótipo local de engenharia de aplicações com Large Language Models (LLMs) focado em apoiar a reflexão pedagógica sobre **planejamentos fictícios**. A arquitetura foi desenhada para ser simples, explícita, auditável e didática — sem frameworks de orquestração opacos (LangChain, LangGraph, CrewAI, etc.) e sem dependências de bancos de dados ou serviços externos além da API REST do Gemini.

A fronteira principal do sistema é a separação rigorosa entre:
- **Navegador (Frontend React + TypeScript + Vite + CSS):** coleta os dados fictícios, valida preliminarmente com Zod, controla cancelamento (`AbortController`), exibe etapas reais e permite revisar, editar e copiar o resultado. **Nunca recebe nem armazena `GEMINI_API_KEY`.**
- **Servidor (Cloudflare Pages Functions locais via Wrangler):** aplica controles HTTP (bloqueio de endpoints hospedados, mesma origem, `Content-Type`, limite de 12 KB), executa a validação definitiva com Zod, chama o cliente Gemini centralizado, coordena o fluxo multiagente + function calling e valida toda saída antes de devolvê-la ao navegador.

---

## 2. Organização por Responsabilidades

| Camada | Arquivos | Responsabilidade |
|---|---|---|
| **Schemas & Contratos** | `src/schemas/plan.ts`, `src/schemas/multi.ts` (+ re-exports em `src/schema.ts`, `src/multi-schema.ts`) | Contratos Zod de entrada, saída do provedor, analista, revisor, argumentos de ferramenta, eventos NDJSON e erros HTTP. |
| **Prompts Versionados** | `src/prompts/history.ts`, `src/prompts/single.ts`, `src/prompts/agents.ts` (+ `src/prompt.ts`) | Preservação das versões históricas V1–V3/multi-v1 e definições explícitas da V2 (`single-v4`, `multi-v2`). |
| **Hardening HTTP** | `src/server/http.ts` | Bloqueio de hospedagem (`503`), conferência de origem (`403`), `Content-Type` (`415`), leitura limitada a 12 KB (`413`), cabeçalhos de segurança. |
| **Cliente Gemini** | `src/server/gemini/client.ts` | Comunicação REST com `gemini-3.5-flash-lite`, limite de 64 KB na resposta, extração segura de JSON ignorando `thought: true`, mapeamento sanitizado de erros HTTP. |
| **Ferramenta Local** | `src/server/agents/tool.ts` | Allowlist estrita (`consultar_criterio_ficticio`) com 4 temas fixos e dados demonstrativos locais. |
| **Orquestrador** | `src/server/agents/orchestrator.ts` | Máquina de estados determinística (máximo 4 chamadas sequenciais), preservação de `id` e `thoughtSignature`, políticas de fallback e revisão única. |
| **Endpoints API** | `functions/api/analyze.ts`, `functions/api/multi.ts` | Pontos de entrada HTTP para agente único (JSON) e multiagente (streaming NDJSON). |
| **Frontend** | `src/main.tsx`, `src/components/PlanForm.tsx`, `src/components/ResultPanel.tsx`, `src/utils/formatReview.ts`, `src/data/examples.ts`, `src/style.css` | Interface acessível e responsiva, apresentação estruturada + área editável/copiável, rastreio real de execução. |
| **Preparação Futura** | `src/server/turnstile.ts` | Verificador Turnstile isolado (não conectado às rotas e não habilita hospedagem). |

---

## 3. Diagrama da Arquitetura Geral

```mermaid
flowchart LR
    User["Pessoa educadora (Navegador)"] --> UI["Frontend React + TS + CSS"]
    UI -->|"Validação preliminar Zod"| UI
    UI -->|"POST /api/analyze (JSON)"| EP1["functions/api/analyze.ts"]
    UI -->|"POST /api/multi (NDJSON)"| EP2["functions/api/multi.ts"]

    EP1 --> HTTP["src/server/http.ts (Bloqueio 503, Origem, 12 KB, Zod)"]
    EP2 --> HTTP

    HTTP -->|"Modo único"| Client["src/server/gemini/client.ts"]
    HTTP -->|"Modo multiagente"| Orch["src/server/agents/orchestrator.ts"]

    Orch --> Tool["src/server/agents/tool.ts (Allowlist local)"]
    Orch --> Client

    Client -->|"HTTPS POST + x-goog-api-key (64 KB max)"| Gemini["Gemini REST API (gemini-3.5-flash-lite)"]
    Gemini -->|"JSON / functionCall"| Client
```

---

## 4. Fluxo de Agente Único (`/api/analyze`)

```mermaid
sequenceDiagram
    participant U as Navegador (App.tsx)
    participant F as functions/api/analyze.ts
    participant H as server/http.ts
    participant C as server/gemini/client.ts
    participant G as Gemini API

    U->>U: Valida planSchema (Zod)
    U->>F: POST /api/analyze (JSON, AbortSignal)
    F->>H: validateLocalApiRequest + parsePlanRequest
    alt Falha de guarda ou schema
        H-->>U: HTTP 400/403/413/415/503 (JSON sanitizado)
    else Requisição válida
        F->>C: callGemini (timeout 25s + request.signal)
        C->>G: POST generateContent (systemPrompt + buildPrompt + JSON Schema)
        G-->>C: HTTP 200 (até 64 KB)
        C->>C: extractStructuredJson (filtra thought=true, <=20 KB)
        F->>F: reviewSchema.safeParse
        F-->>U: HTTP 200 JSON validado (Cache-Control: no-store)
        U->>U: Exibe cards estruturados + área editável/copiável
    end
```

---

## 5. Fluxo Multiagente (`/api/multi`)

```mermaid
flowchart TD
    Start["POST /api/multi validado (Zod + HTTP Guards)"] --> S1["Chamada 1: Analista solicita ferramenta (mode: ANY)"]
    S1 --> TCheck{"1 functionCall válido na allowlist?"}
    TCheck -->|"Não"| FailAbort["Erro sanitizado em NDJSON e encerramento"]
    TCheck -->|"Sim"| ToolRun["Executa consultar_criterio_ficticio local"]
    ToolRun --> S2["Chamada 2: Analista recebe functionResponse + histórico completo"]
    S2 --> AValid{"Passa em analystSchema?"}
    AValid -->|"Não"| FailAbort
    AValid -->|"Sim"| S3["Chamada 3: Revisor Crítico independente"]
    S3 --> CValid{"Revisor respondeu e passou em criticSchema?"}
    CValid -->|"Falha não-abortada"| FallbackCritic["Preserva análise original (estado: com_ressalvas)"]
    CValid -->|"Sim"| Decision{"Decisão do Revisor"}
    Decision -->|"CONSOLIDAR sem problemas"| DoneOk["estado: consolidado (3 chamadas)"]
    Decision -->|"CONSOLIDAR com problemas ou RESSALVAS"| DoneWarn["estado: com_ressalvas (3 chamadas)"]
    Decision -->|"REVISAR"| S4["Chamada 4: Analista realiza 1 revisão adicional"]
    S4 --> RValid{"Passa em analystSchema?"}
    RValid -->|"Sim"| DoneRev["estado: revisado_sem_reavaliacao (4 chamadas)"]
    RValid -->|"Falha não-abortada"| FallbackRev["Preserva análise anterior (estado: com_ressalvas)"]
```

---

## 6. Fluxo de Function Calling

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant G as Gemini API
    participant T as server/agents/tool.ts

    O->>G: Prompt Analista + toolDeclaration + mode: ANY + allowedFunctionNames
    G-->>O: parts contendo functionCall { id, name, args } + thoughtSignature
    O->>O: Verifica exatamente 1 functionCall + functionCallSchema (Zod)
    O->>T: runTool(name, args)
    T->>T: Allowlist (name === 'consultar_criterio_ficticio') + toolArgsSchema (4 temas)
    T-->>O: { tema, criterio, natureza: 'exemplo fictício, não é norma' }
    O->>G: Histórico [user, model(parts originais), user(functionResponse com mesmo id/name)]
    G-->>O: JSON estruturado do Analista
```

---

## 7. Fluxo de Tratamento de Falhas

```mermaid
flowchart TD
    Req["Requisição recebida"] --> G1{"Endpoint local autorizado?"}
    G1 -->|"Não"| E503["HTTP 503 HOSTED_BLOCKED"]
    G1 -->|"Sim"| G2{"Origem + JSON + Chave + <=12 KB + Zod?"}
    G2 -->|"Não"| E4XX["HTTP 400 / 403 / 413 / 415 / 503"]
    G2 -->|"Sim"| Call["Chamada ao Gemini (sem retry automático)"]
    Call --> Outcome{"Resultado da chamada"}
    Outcome -->|"HTTP 429/400/401/403/404/5xx"| EProv["ProviderError sanitizado (HTTP 502 / evento erro)"]
    Outcome -->|"Timeout (25s único / 20s chamada / 75s fluxo)"| ETime["Abortado -> mensagem amigável de tempo limite"]
    Outcome -->|"Cancelamento do navegador"| ECancel["AbortSignal propagado -> encerramento limpo"]
    Outcome -->|"JSON inválido ou fora do Zod"| EVal["Rejeição explícita (sem correção silenciosa)"]
    Outcome -->|"Falha no Revisor ou na 4ª chamada"| EPartial["Degradação segura: preserva análise já validada + estado com_ressalvas"]
```

---

## 8. Decisões Arquiteturais Explícitas

1. **Zero retries automáticos:** repetir chamadas silenciosamente pode multiplicar consumo de cota/custo e mascarar falhas de schema ou rate limit (`429`).
2. **Teto rígido de 4 chamadas:** aplicado em duas camadas (`orchestrate` e `createGateway`), impedindo loops infinitos mesmo sob respostas anômalas do modelo.
3. **Validação estrita em vez de autocorreção silenciosa:** se o modelo devolver JSON malformado ou omitir campos obrigatórios, o backend rejeita a resposta em vez de "inventar" valores padrão que distorçam o significado.
4. **Honestidade de interface:** o modo agente único não finge progresso em etapas (porque é uma chamada única HTTP), enquanto o modo multiagente transmite eventos NDJSON reais à medida que cada etapa conclui no servidor.
