# Preparação para um futuro deploy

**Bloqueio obrigatório:** a função atualmente rejeita todos os pedidos hospedados no código. Não remova esse bloqueio apenas com variáveis; ele existe porque a proteção contra abuso/custo ainda não está completa. Não foi feito deploy.

Configuração prevista: Node.js 24.14.0; build `npm run build`; diretório `dist`; raiz do projeto; Pages Functions em `functions/`. Configure `GEMINI_API_KEY` como segredo no Pages, nunca como variável Vite. Não use `LOCAL_DEV=true` em ambiente hospedado; não exponha o servidor de desenvolvimento. Segredos de Turnstile devem permanecer no servidor.

Antes de alterar o bloqueio, implementar e testar em conjunto:
1. Cloudflare Access restrito e validado no servidor, cobrindo domínio principal, endpoint e todos os previews; ou solução equivalente de autenticação autorizada.
2. Widget Turnstile e envio do token pelo cliente; chamada ao Siteverify pelo servidor, checando sucesso, hostname e ação esperada e tratando expiração, reutilização, falhas e timeout. `src/server/turnstile.ts` é apenas um ponto de partida isolado: não há widget, integração com a rota ou validação de action.
3. Rate limiting no Cloudflare/WAF e limite global durável e atômico por período e conta, adequado a execução distribuída. Limite em memória ou por IP isolado não é garantia de teto.
4. Conferência de plano, cotas e alertas de orçamento no provedor. Alertas não são um teto de gastos garantido. Manter faturamento desativado salvo autorização explícita.
5. Revisão de origem, CSRF, captura de erros, timeout, limites de entrada e saída e retenção de dados. Validar testes negativos antes de abrir acesso.

Depois da implementação e autorização para deploy, testar usuário não autorizado, token ausente/inválido/reutilizado, limite excedido, proteção de previews, falhas do provedor e fluxo real somente com planejamento fictício. Conferir custos, logs e que o segredo nunca aparece no bundle. Não enviar chave em issue, captura, log ou commit.

Referências: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ ; https://developers.cloudflare.com/pages/functions/bindings/ ; https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/ ; https://ai.google.dev/gemini-api/docs/pricing
