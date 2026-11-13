# Relatório de testes

Data: 13/11/2026. Windows, Node.js 24.14.0; execução local com dados fictícios.

## Comandos finais

| Verificação | Resultado observado |
|---|---|
| `npm ci --no-audit --no-fund` | Passou depois de encerrar o servidor local. A primeira tentativa falhou com EPERM porque o executável workerd estava em uso. |
| `npm run typecheck` | Passou. |
| `npm test` | 24 testes passaram em 2 arquivos; nenhuma falha na execução final. Todos os testes de integração automatizados usam mocks. |
| `npm run build` | Passou; Rollup avisou que removeria duas anotações em comentários de Zod. |
| `npx wrangler pages functions build --outfile .wrangler/verification.js` | Passou. |
| `npm audit` | Zero vulnerabilidades conhecidas no momento da execução. |

Os testes cobrem campos válidos, ausentes e excessivos; formato e limites de resposta; JSON inválido, fora do esquema ou ausente; 429 e outros HTTP; timeout; conexão; chave ausente; proteção de origem; bloqueio hospedado; construção do prompt com instrução indevida como dado; exemplo, erro, edição e cópia no frontend; e verificador Turnstile isolado com mocks. Eles não medem resistência do modelo a prompt injection nem comprovam proteção de produção.

## Integração real e interface

Após confirmar o nível gratuito da chave no Google AI Studio, foram feitas seis chamadas reais da matriz de prompts, com HTTP 200 e JSON aceito pelo Zod. Uma sétima chamada real foi feita pelo fluxo navegador → Pages Function → Gemini → validação → navegador e exibiu resultado. Foram sete novas chamadas nesta missão, dentro do limite de oito. Não houve chamada adversarial real.

Capturas em `docs/imagens/`: formulário fictício, carregamento durante chamada real, resultado real e layout em largura de 390 px. A verificação encontrou largura de conteúdo de 375 px para viewport de 390 px; não houve transbordamento horizontal nesse caso. O primeiro Tab focalizou o botão de exemplo; edição e cópia foram verificadas por teste automatizado e também anteriormente no navegador. Isso não é auditoria completa de acessibilidade nem teste em vários aparelhos.

## Segurança e limites

`.dev.vars`, `.env` e derivados sensíveis estão ignorados; a chave não deve ser exposta em screenshots, relatórios ou logs. A varredura final compara a chave local em memória com os arquivos preparados e o build, sem imprimi-la, além de procurar padrões comuns. Nenhuma varredura garante ausência de todo segredo. O endpoint hospedado retorna 503 por padrão e não possui ainda controle de consumo distribuído. Turnstile está somente preparado como função isolada e não protege a rota atual.

Uma tentativa anterior nesta sessão de trabalho histórica retornou 502 genérico antes de chamadas posteriores bem-sucedidas; a causa não foi identificada. A qualidade pedagógica e os resultados dos prompts não foram avaliados por especialista. Não houve deploy.


## Atualização multiagente

Após a evolução, executei novamente npm ci, TypeScript, build, compilação Pages, npm audit e a suíte: **45 testes passaram** em cinco arquivos; auditoria npm sem vulnerabilidades conhecidas. O build ainda apresenta dois avisos sobre anotações de comentários de Zod. Os testes automatizados usam mocks e cobrem ferramenta, decisões, limites, erros, timeout e cancelamento. Um fluxo real de três chamadas concluiu; duas tentativas anteriores falharam na validação. O teste real de prompt injection não foi realizado. Veja EXPERIMENTOS_AGENTES.md.
