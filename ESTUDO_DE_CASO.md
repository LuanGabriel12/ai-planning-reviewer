# Estudo de caso

Criei o AI Planning Reviewer para aprender a integrar um LLM a uma aplicação web com uma fronteira clara entre navegador e servidor. Escolhi a revisão de planejamentos fictícios porque ela permite explorar alinhamento entre objetivos, atividades e avaliação, mantendo a decisão com uma pessoa educadora.

O formulário React envia os campos a uma Pages Function. O servidor valida a entrada, chama o Gemini com uma chave privada, pede JSON estruturado e valida a resposta com Zod. A interface apresenta o resultado para edição e cópia. Eu usei o Codex para auxiliar na construção, testes e documentação; as decisões de uso e publicação precisam de revisão humana.

No experimento, os seis casos da matriz retornaram JSON válido, mas respostas anteriores e algumas desta rodada contêm afirmações que precisam ser verificadas. Aprendi que aderir a um esquema é diferente de oferecer uma resposta factual e pedagogicamente adequada. Escolhi a V3 como ponto de partida por explicitar limites, sem reivindicar superioridade estatística.

O endpoint hospedado segue bloqueado: faltam limites distribuídos, proteção de orçamento, integração completa de Turnstile e autenticação testada. O protótipo não foi validado por especialista nem aplicado em escolas.
