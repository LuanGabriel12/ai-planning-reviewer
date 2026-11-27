# Function Calling — AI Planning Reviewer V2

## 1. Visão Geral

No modo multiagente, a primeira chamada do Agente Analista utiliza o recurso nativo de **Function Calling** da API REST do Gemini para consultar uma ferramenta local e determinística definida em [src/server/agents/tool.ts](../src/server/agents/tool.ts).

> **Aviso importante:** os critérios consultados pela ferramenta são **100% fictícios e demonstrativos**. Eles representam perguntas de apoio à reflexão pedagógica e **não constituem normas oficiais de educação** (como BNCC, diretrizes estaduais ou regulamentos escolares).

---

## 2. Especificação da Ferramenta

- **Nome autorizado (allowlist única):** `consultar_criterio_ficticio`
- **Modo de invocação no Gemini:** `toolConfig.functionCallingConfig.mode = 'ANY'` com `allowedFunctionNames: ['consultar_criterio_ficticio']`.
  - Isso significa que, na Chamada 1, o modelo **é instruído a solicitar a ferramenta**, cabendo a ele escolher qual dos 4 temas é mais pertinente ao planejamento recebido. Isso é documentado com transparência: não se trata de "escolha autônoma irrestrita de ferramentas".
- **Temas permitidos (`TOOL_THEMES`):**
  1. `objetivos`
  2. `atividades`
  3. `avaliacao`
  4. `alinhamento`
- **Retorno local (`ToolExecutionOutput`):**
  ```json
  {
    "tema": "avaliacao",
    "criterio": "Exemplo: a avaliação descreve evidências e critérios relacionados diretamente aos objetivos?",
    "natureza": "exemplo fictício, não é norma"
  }
  ```

---

## 3. Controles de Segurança e Validação

O modelo **nunca** executa código diretamente. Ele apenas devolve uma intenção estruturada (`functionCall`), que o servidor audita antes de chamar qualquer função local:

| Vetor verificado | Comportamento implementado no servidor |
|---|---|
| **Chamada malformada ou truncada pelo provedor** (`finishReason: 'MALFORMED_FUNCTION_CALL'`, `'MAX_TOKENS'`, `'SAFETY'`, etc.) | Rejeitada imediatamente por `extractPrimaryCandidate` (`assertAcceptableFinishReason`) na Chamada 1, antes de inspecionar ou executar qualquer ferramenta. |
| **Ferramenta desconhecida** (ex.: `fetch`, `ler_arquivo`, `exfiltrar`) | Recusada imediatamente por `runTool` (`if (name !== TOOL_NAME) throw ...`) antes de qualquer execução. |
| **Argumentos inválidos ou extras** (ex.: `{ tema: 'avaliacao', url: 'https://...' }`) | Rejeitados por `toolArgsSchema` (`z.object({ tema: z.enum(...) }).strict()`). |
| **Chamadas ausentes ou repetidas/múltiplas** (`0` ou `2+` `functionCall` parts) | Rejeitadas pelo orquestrador (`if (toolCallParts.length !== 1) throw ...`). |
| **Ausência de `id` na chamada** | Rejeitada por `functionCallSchema` (`id: z.string().trim().min(1).max(200)`). |
| **Correspondência entre chamada e resposta** | A Chamada 2 reenvia integralmente `toolTurnCandidate.content.parts` (preservando `id` e eventual `thoughtSignature`) seguido de `{ functionResponse: { name: functionCall.name, id: functionCall.id, response: toolResult } }`. |
| **Isolamento de execução** | `runTool` apenas consulta um objeto em memória (`FICTITIOUS_CRITERIA`). Não acessa filesystem, terminal, variáveis de ambiente, credenciais nem rede. |

---

## 4. Transparência na Interface

Na V2, o campo `ferramentaDetalhes` (`{ nome, tema, natureza }`) é retornado no payload validado por `multiResultSchema` e exibido na interface (ex.: `Ferramenta: consultar_criterio_ficticio (avaliacao — fictício)`), permitindo à pessoa usuária saber exatamente qual critério local foi injetado no contexto do analista.
