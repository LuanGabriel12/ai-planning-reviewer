# Segurança e Privacidade — AI Planning Reviewer V2

## 1. Postura de Segurança

O AI Planning Reviewer V2 é um **protótipo de execução exclusivamente local** com dados **estritamente fictícios**. Os controles descritos abaixo reduzem riscos comuns em aplicações com LLMs, mas **não** substituem controles distribuídos de produção e **não** garantem ausência total de vulnerabilidades nem conformidade jurídica formal.

---

## 2. Controles Efetivamente Implementados no Código

| Camada | Controle | Evidência no código |
|---|---|---|
| **Credenciais** | `GEMINI_API_KEY` lida apenas no servidor (`env.GEMINI_API_KEY`) e enviada via cabeçalho HTTP `x-goog-api-key`. | `src/server/gemini/client.ts`, `src/server/http.ts`, `.gitignore` |
| **Arquivos ignorados** | `.env`, `.env.*` (exceto `.env.example`), `.dev.vars*`, `node_modules/`, `dist/`, `.wrangler/`. | `.gitignore` |
| **Bloqueio de hospedagem** | `/api/analyze` e `/api/multi` retornam HTTP `503 HOSTED_BLOCKED` sempre que `LOCAL_DEV !== 'true'` ou o hostname não for `localhost` / `127.0.0.1` — **mesmo se variáveis de produção ou Access forem definidas**. | `src/server/http.ts` (`isLocalRequestAllowed`) |
| **Origem e mídia** | Validação estrita `request.headers.get('origin') === url.origin` (`403`) e `Content-Type: application/json` (`415`). | `src/server/http.ts` (`validateLocalApiRequest`) |
| **Cabeçalhos HTTP** | `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` em todas as respostas (sucesso, erro e stream). | `src/server/http.ts`, `functions/api/multi.ts` |
| **Limites de tamanho** | Corpo da requisição limitado a `12.000` bytes (`413`); resposta do provedor limitada a `64.000` bytes; texto JSON extraído limitado a `20.000` caracteres; stream NDJSON no cliente limitado a `100.000` bytes. | `src/server/http.ts`, `src/server/gemini/client.ts`, `src/utils/formatReview.ts` |
| **Limites de execução** | Máximo de `4` chamadas por execução multiagente; timeouts de `25s` (único), `20s` por chamada e `75s` total; `0` retries automáticos; propagação de cancelamento (`AbortSignal`). | `src/server/gemini/client.ts`, `src/server/agents/orchestrator.ts`, `functions/api/analyze.ts` |
| **Function Calling seguro** | Allowlist única (`consultar_criterio_ficticio`), argumentos validados estritamente com Zod (4 temas fixos), exatamente 1 chamada permitida, execução local somente leitura sem rede/disco/shell. | `src/server/agents/tool.ts`, `src/server/agents/orchestrator.ts` |
| **Sanitização de erros e logs** | Erros devolvem mensagens amigáveis sem corpo bruto da API, sem credenciais, sem stack traces e sem caminhos internos; logs do multiagente resumem apenas categorias/caminhos seguros. | `src/server/gemini/client.ts`, `functions/api/multi.ts` |
| **Renderização segura** | O React renderiza todo texto produzido pela IA como nós de texto e valores de `<textarea>` (sem `dangerouslySetInnerHTML`), mitigando XSS refletido na interface. | `src/components/ResultPanel.tsx` |
| **Fronteira de dados no prompt** | Separação `systemInstruction` vs `<planejamento>JSON</planejamento>` + instrução explícita para tratar campos como dados não confiáveis. | `src/prompts/single.ts`, `src/prompts/agents.ts` |

---

## 3. Limitações Reconhecidas (Transparência Obrigatória)

1. **Prompt injection NÃO é considerado eliminado:** prompts defensivos e validação de schema reduzem a superfície de impacto, mas modelos de linguagem podem ainda obedecer a instruções adversariais no conteúdo semântico da resposta. Testes automatizados com mocks verificam a construção dos prompts e os bloqueios do servidor — **não comprovam resistência do modelo real a ataques adversariais**.
2. **Sem proteção distribuída de produção:** não existem rate limiting distribuído (Cloudflare WAF/Durable Objects), cota global atômica de custo, autenticação ativa de usuários nem proteção de preview deployments. Por isso, o bloqueio `503` em código **deve permanecer ativo** e nenhum deploy público foi realizado.
3. **Turnstile isolado:** `src/server/turnstile.ts` é apenas um utilitário preparado e testado com mocks; não há widget no frontend nem integração na rota.
4. **Privacidade de dados:** não existe detector confiável de dados pessoais (PII). Quando o usuário executa chamadas reais localmente, o conteúdo digitado é enviado à API do Google Gemini. Portanto, **nunca** envie nomes reais, dados de estudantes, escolas ou documentos confidenciais.
5. **Escopo de rede local:** ao executar `npm run preview:full`, mantenha o vínculo exclusivo em `127.0.0.1` e não exponha o servidor à rede local ou via túneis públicos.

Para o checklist completo exigido antes de qualquer publicação futura, consulte o registro preservado em [docs/historico/CLOUDFLARE_DEPLOY_FUTURO.md](historico/CLOUDFLARE_DEPLOY_FUTURO.md).
