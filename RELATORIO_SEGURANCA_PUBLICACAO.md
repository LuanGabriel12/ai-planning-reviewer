# Segurança e publicação

## Escopo
Auditoria proporcional ao protótipo: alterações, arquivos do commit e histórico Git completo acessível localmente; padrões comuns de credenciais e comparação em memória com a chave atual sem imprimi-la; inspeção de capturas e buscas por dados pessoais; verificação de `.gitignore`, build, endpoint e logs operacionais. A varredura reduz risco, não garante ausência de todos os segredos ou dados privados.

A chave local `.dev.vars` não é parte do frontend nem deve ser versionada. A chamada Gemini usa cabeçalho no servidor; a ferramenta é allowlist local, sem acesso a rede ou arquivos. Entradas e saídas passam por limites e esquemas, e eventos de progresso não incluem o planejamento ou resposta bruta. A primeira análise pode falhar; o sistema não converte falhas em aprovações. Não há logs de prompts ou credenciais no código multiagente; mensagens de erro são categorias sanitizadas.

Os endpoints hospedados continuam bloqueados por condição explícita. `LOCAL_DEV=true` é exclusivamente para desenvolvimento local vinculado a loopback, sem túnel. Não há limite distribuído, quota global durável, autenticação de produção, nem Turnstile integrado. `src/server/turnstile.ts` é apenas um auxiliar isolado com testes simulados. A publicação do código-fonte não constitui autorização para abrir a API.

O modelo recebe dados não confiáveis e pode seguir instruções maliciosas, inventar fatos ou deixar de detectar erros. Não há garantia contra prompt injection ou detector confiável de dados pessoais. A revisão adicional não é reavaliada; o usuário precisa analisar o resultado.

Antes de qualquer deploy, implementar controle distribuído atômico de chamadas, acesso autenticado, Turnstile completo com validação no servidor, proteção de previews e limites de gastos; testar esses controles. Não foi feito deploy. Consulte [CLOUDFLARE_DEPLOY_FUTURO.md](CLOUDFLARE_DEPLOY_FUTURO.md).



## Resultado da verificação em 13/11/2026

Foram examinados 47 objetos Git alcançáveis nos dois commits anteriores e 109 arquivos atuais, build e artefatos locais de execução, com comparação da chave atual e padrões comuns de segredos: nenhum indício e nenhum erro de leitura. Não foram encontrados arquivos .dev.vars ou .env no histórico. As imagens JPG do projeto tinham zero campos EXIF; as capturas inspecionadas mostram apenas exemplos fictícios. A verificação de padrões e inspeção visual não são provas de ausência de todos os dados sensíveis. Uma nova verificação do commit final deve ser executada antes da mudança de visibilidade.
