# Engenharia de Prompts — AI Planning Reviewer V2

## 1. Objetivo e Princípios

Na engenharia de aplicações com LLMs, o prompt define o contrato comportamental do modelo, enquanto o JSON Schema e o Zod definem o contrato estrutural. Ambos se complementam, mas nenhum dos dois garante correção factual ou pedagógica absoluta.

Os prompts deste projeto seguem seis princípios explícitos:
1. **Separação clara entre instruções de sistema e dados do usuário** (`systemInstruction` vs `<planejamento>JSON</planejamento>`).
2. **Definição de papel limitado:** apoiar a reflexão humana sem aprovar, reprovar, dar nota ou substituir uma pessoa educadora.
3. **Distinção epistemológica obrigatória:** separar informação presente no planejamento, interpretação/inferência, sugestão, informação ausente e suposição não confirmada.
4. **Proibição de inventar fatos ou normas:** nunca apresentar uma sugestão como fato fornecido pelo usuário e nunca alegar conformidade com normas oficiais (como BNCC) sem base explícita.
5. **Tratamento de lacunas:** sinalizar explicitamente o que falta (duração, recursos, critérios) em vez de preencher lacunas por suposição.
6. **Defesa em profundidade contra instruções adversariais:** declarar explicitamente que campos do planejamento e revisões são dados não confiáveis, nunca instruções executáveis (ciente de que prompts mitigam, mas não eliminam prompt injection).

---

## 2. Preservação das Versões Históricas (V1–V3 e Multi-V1)

Todas as versões anteriores foram preservadas em [src/prompts/history.ts](../src/prompts/history.ts) e nos registros experimentais reais em `prompt-lab/`:

| Versão | Registro Histórico | Características | Limitações Observadas nas Chamadas Reais (13/11/2026) |
|---|---|---|---|
| **Single V1** | `prompt-lab/resultados-reais.json` e `matriz-2026-11-13.json` | Prompt curto sem `systemInstruction`. | Alegou alinhamento à BNCC sem evidência e recomendou tampar recipiente sem fundamentar. |
| **Single V2** | `prompt-lab/resultados-reais.json` e `matriz-2026-11-13.json` | Pediu comparação entre campos e proibiu aprovação/reprovação, sem `systemInstruction` nem tags delimitadoras. | Expressou garantia excessiva de compreensão e introduziu suposições sobre superfície/tampa ausentes no texto. |
| **Single V3** | Adotada na V1 (`src/prompt.ts`) | `systemInstruction` dedicada, delimitação `<planejamento>`, instrução para apontar lacunas e tratar campos como dados. | Melhor cautela qualitativa no Exemplo B, mas no Exemplo A apresentou afirmação tecnicamente imprecisa sobre visualização direta da evaporação. |
| **Multi V1** | `prompt-lab/experimento-multi-real.json` | Separação Analista + Revisor Crítico + ferramenta local. | Na chamada real concluída, o Analista supôs disponibilidade de recursos na escola e descreveu avaliação em grupo ambígua; o Revisor ainda escolheu `CONSOLIDAR`. |

> Os dados completos dessas execuções reais históricas permanecem preservados em [docs/historico/PROMPT_ENGINEERING.md](historico/PROMPT_ENGINEERING.md), [docs/historico/EXPERIMENTOS_AGENTES.md](historico/EXPERIMENTOS_AGENTES.md) e [prompt-lab/](../prompt-lab/).

---

## 3. Evolução Proposta na V2 (`single-v4` e `multi-v2`)

### 3.1. Agente Único — `single-v4` ([src/prompts/single.ts](../src/prompts/single.ts))

**Mudanças em relação à V3:**
- Explicita as cinco categorias que o modelo deve distinguir: *fato fornecido*, *interpretação*, *sugestão*, *informação ausente* e *suposição não confirmada*.
- Proíbe expressamente apresentar uma sugestão como se tivesse sido informada pelo usuário.
- Reforça a fronteira de segurança mencionando explicitamente tentativas de mudança de papel e pedidos de divulgação de informações internas.
- Alinha `responseJsonSchema` aos limites exatos do Zod (`minItems: 1, maxItems: 5, minLength: 1, maxLength: 700`).

### 3.2. Modo Multiagente — `multi-v2` ([src/prompts/agents.ts](../src/prompts/agents.ts))

**Mudanças em relação à `multi-v1`:**
- **Agente Analista:** explicita exatamente o que deve ir em `fatosInformados` (somente texto presente no planejamento) versus `inferencias` (interpretações, lacunas ou suposições não confirmadas), atacando diretamente o problema observado no experimento real da V1.
- **Agente Revisor Crítico:** recebe instrução explícita para **não concordar automaticamente** com o analista e checklist concreto de verificação (fatos inventados, suposições não justificadas, contradições, sugestões genéricas, problemas de alinhamento omitidos e sugestões disfarçadas de fato), além de critérios objetivos para escolher `CONSOLIDAR`, `REVISAR` ou `RESSALVAS`.
- **Delimitação consistente:** todos os prompts multiagente delimitam payloads não confiáveis com tags XML-like (`<planejamento>`, `<dados_para_revisao>`, `<dados_para_revisao_adicional>`).

---

## 4. Transparência sobre Evidências

- **Nenhuma afirmação de superioridade sem evidência:** as melhorias de `single-v4` e `multi-v2` são justificadas por análise de engenharia sobre falhas reais observadas na V1, mas **ainda não foram avaliadas em chamadas reais ao Gemini** nesta entrega V2 (pois chamadas reais aguardam autorização explícita de consumo).
- O protocolo reproduzível para comparar empiricamente V1/V3 vs V4 e agente único vs multiagente está pronto em [EVALUATION_METHODOLOGY.md](EVALUATION_METHODOLOGY.md) e [experiments/](../experiments/).
