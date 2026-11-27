# Integração com LLM (Gemini REST API)

## 1. Visão Geral

Toda a comunicação com o provedor de IA está centralizada em [src/server/gemini/client.ts](../src/server/gemini/client.ts). Tanto o endpoint de agente único ([functions/api/analyze.ts](../functions/api/analyze.ts)) quanto o gateway do orquestrador multiagente ([src/server/agents/orchestrator.ts](../src/server/agents/orchestrator.ts)) utilizam esse mesmo módulo, eliminando duplicação e garantindo políticas consistentes de segurança, tamanho e tratamento de erros.

---

## 2. Configuração Efetivamente Verificada

| Parâmetro | Valor configurado no código | Observações |
|---|---|---|
| **Modelo** | `gemini-3.5-flash-lite` | Preservado integralmente da V1; não foi alterado silenciosamente. |
| **Endpoint REST** | `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent` | Chamado exclusivamente do lado servidor via `fetch`. |
| **Autenticação** | Cabeçalho HTTP `x-goog-api-key` | Lido de `env.GEMINI_API_KEY`; nunca trafega em query string nem no bundle do frontend. |
| **Temperatura** | `0.3` | Busca respostas mais estáveis mantendo alguma flexibilidade redacional. |
| **Limite de tokens de saída** | `2048` (análise/revisão) e `1024` (seleção da ferramenta) | Definido em `generationConfig.maxOutputTokens`. |
| **Formato estruturado** | `responseMimeType: 'application/json'` + `responseJsonSchema` | Alinhado aos limites de array e string dos schemas Zod. |
| **Limite de corpo da resposta HTTP** | `64.000` bytes (64 KB) | Leitura incremental com cancelamento imediato do stream se excedido. |
| **Limite de texto JSON extraído** | `20.000` caracteres | Verificado antes de `JSON.parse`. |
| **Timeout** | `25s` (agente único), `20s` por chamada e `75s` total (multiagente) | Combinado com cancelamento do cliente via `AbortSignal`. |
| **Retries automáticos** | **0 (desabilitado)** | Evita multiplicação silenciosa de consumo ou rajadas contra HTTP 429. |

> **Nota sobre cotas, disponibilidade e preços:** este documento **não** afirma limites, preços ou cotas atuais do Google AI Studio, pois esses valores dependem da conta e podem mudar no provedor. Na rodada histórica da V1 (13/11/2026), a chave foi conferida manualmente como nível gratuito antes do lote; novas chamadas reais exigem nova verificação prévia pelo titular.

---

## 3. Fluxo de Extração Segura (`extractStructuredJson`)

Uma melhoria relevante da V2 foi unificar a extração de texto estruturado no cliente Gemini:

1. **Validação do envelope (`geminiEnvelopeSchema`):** garante a existência de `candidates[0]` (com `content.parts` opcional no parse inicial para permitir diagnóstico preciso de `finishReason` mesmo quando o provedor omite `content`).
2. **Política fail-closed de `finishReason` (`assertAcceptableFinishReason`, aplicada em `extractPrimaryCandidate`):** conforme a documentação oficial da Gemini API, aceita somente ausência do campo (mocks mínimos) ou `STOP`. Rejeita explicitamente:
   - `MAX_TOKENS` → `ProviderError('incomplete_output', ...)` (evita aceitar JSON cortado ou truncado);
   - `MALFORMED_FUNCTION_CALL`, `UNEXPECTED_TOOL_CALL`, `TOO_MANY_TOOL_CALLS` → `ProviderError('malformed_function_call', ...)`;
   - `SAFETY`, `RECITATION`, `BLOCKLIST`, `PROHIBITED_CONTENT`, `SPII`, `IMAGE_SAFETY`, `IMAGE_PROHIBITED_CONTENT` → `ProviderError('blocked_output', ...)`;
   - Qualquer outro código não-`STOP` (`OTHER`, `LANGUAGE`, etc.) → `ProviderError('incomplete_output', ...)`.
   Essa política protege tanto as etapas de JSON estruturado quanto a **primeira etapa de function calling** no modo multiagente.
3. **Verificação de `content.parts` e filtro `part.thought !== true`:** garante que `parts` não esteja vazio e descarta partes internas de raciocínio, impedindo corrupção do JSON e exposição acidental de texto interno.
4. **Multiplicidade e tamanho:** exige exatamente 1 parte textual visível não vazia com no máximo `20.000` caracteres.
5. **Parse controlado:** envolve `JSON.parse` em `try/catch`, convertendo qualquer erro sintático em `ProviderError('invalid_structured_json', ...)`.
6. **Validação final de domínio:** o JSON extraído ainda precisa passar pelos schemas Zod específicos (`reviewSchema`, `analystSchema` ou `criticSchema`).

---

## 4. Mapeamento Sanitizado de Erros

O cliente nunca devolve o corpo bruto retornado pelo Google, stack traces ou a chave da API para o navegador:

| Situação no provedor | `ProviderError.kind` | Resposta HTTP ao cliente (`/api/analyze`) | Comportamento no `/api/multi` |
|---|---|---|---|
| HTTP `429` | `rate_limit` | `502` — "Limite do provedor atingido. Tente mais tarde." | Log sanitizado + evento NDJSON `erro` |
| HTTP `400` | `bad_request` | `502` — "O provedor recusou a solicitação (400)." | Log sanitizado + evento NDJSON `erro` |
| HTTP `401` / `403` | `auth` | `502` — "O provedor recusou a chave ou o acesso (autenticação)." | Log sanitizado + evento NDJSON `erro` |
| HTTP `404` | `model_unavailable` | `502` — "O modelo configurado não está disponível para esta chave." | Log sanitizado + evento NDJSON `erro` |
| HTTP `5xx` ou outros | `provider_http` | `502` — "Não foi possível consultar o provedor de IA." | Log sanitizado + evento NDJSON `erro` |
| Resposta > 64 KB | `response_too_large` | `502` — "A resposta da IA excedeu o limite." | Interrompe chamada; sem retry |
| Timeout | `timeout` / `AbortError` | `502` — "A consulta demorou demais." | Interrompe fluxo; sem retry |
| Cancelamento do navegador (prévio ou durante a chamada) | `aborted` (`request.signal.aborted`) | `499` — "Análise cancelada pelo cliente." (verifica `request.signal.aborted` antes de chamar Gemini) | Retorna `499` sem chamar o provedor se já cancelado; propaga `abort.abort()` se cancelado durante o stream |

---

## 5. Separação entre Testes com Mocks e Chamadas Reais

- Toda a suíte `npm test` usa **mocks de `fetch`** e de `Gateway`, executando sem chave real e sem custo.
- Chamadas reais ao Gemini só ocorrem quando o usuário configura `.dev.vars` localmente e interage deliberadamente com o servidor local (`npm run preview:full`) ou autoriza explicitamente um lote de avaliação.
