import {
  ANALYST_SYSTEM_PROMPT,
  CRITIC_SYSTEM_PROMPT,
  buildAnalystRevisionPrompt,
  buildAnalystToolPrompt,
  buildCriticPrompt,
} from '../../prompts/agents';
import {
  analystJSON,
  analystSchema,
  criticJSON,
  criticSchema,
  functionCallSchema,
  multiResultSchema,
  type Analyst,
  type Critic,
  type MultiResult,
} from '../../schemas/multi';
import type { Plan } from '../../schemas/plan';
import {
  MAX_MULTI_CALLS,
  MULTI_CALL_TIMEOUT_MS,
  callGemini,
  extractPrimaryCandidate,
  extractStructuredJson,
} from '../gemini/client';
import { TOOL_NAME, TOOL_NATURE, runTool, toolDeclaration } from './tool';

export type Gateway = (body: Record<string, unknown>) => Promise<unknown>;

/**
 * Cria um gateway de chamadas sequenciais ao Gemini limitado explicitamente a 4 chamadas
 * por execução, com timeout individual de 20s e cancelamento propagado via AbortSignal.
 */
export function createGateway(
  apiKey: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Gateway {
  let calls = 0;

  return async (body) => {
    if (++calls > MAX_MULTI_CALLS) {
      throw new Error('Limite de chamadas');
    }

    const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(MULTI_CALL_TIMEOUT_MS)]);
    return callGemini({
      apiKey,
      body,
      signal: combinedSignal,
      fetcher,
    });
  };
}

const jsonGenerationConfig = (schema: object) => ({
  responseMimeType: 'application/json',
  responseJsonSchema: schema,
  maxOutputTokens: 2048,
  temperature: 0.3,
});

const systemInstruction = (text: string) => ({
  parts: [{ text }],
});

/**
 * Orquestrador determinístico do modo multiagente.
 *
 * Fluxo limitado a no máximo 4 chamadas sequenciais ao modelo:
 * 1. Analista solicita consulta ao critério local fictício (function calling obrigatório: mode ANY).
 *    O backend valida nome/argumentos em allowlist estrita e executa `consultar_criterio_ficticio`.
 * 2. Analista recebe histórico com `parts` originais (preservando `id` e `thoughtSignature`)
 *    e `functionResponse`, retornando JSON estruturado validado por `analystSchema`.
 * 3. Revisor Crítico independente avalia `{ planejamento, analise }` e retorna `criticSchema`.
 *    Se o revisor falhar (sem cancelamento), a análise validada é preservada com ressalva explícita.
 * 4. Se a decisão for `REVISAR`, o orquestrador solicita no máximo UMA revisão adicional ao Analista.
 *    Política explícita: para respeitar o teto de 4 chamadas, a versão revisada NÃO passa por
 *    nova reavaliação automática e é marcada com estado `revisado_sem_reavaliacao`.
 */
export async function orchestrate(
  plan: Plan,
  gateway: Gateway,
  signal: AbortSignal,
  onStage: (stage: string) => void = () => {},
): Promise<MultiResult> {
  let calls = 0;
  const etapas: string[] = [];

  const recordStage = (label: string) => {
    if (signal.aborted) {
      throw new Error('Cancelado');
    }
    etapas.push(label);
    onStage(label);
  };

  const invokeModel = async (payload: Record<string, unknown>) => {
    if (signal.aborted || ++calls > MAX_MULTI_CALLS) {
      throw new Error('Execução cancelada ou limite atingido');
    }
    return gateway(payload);
  };

  // Chamada 1: Analista solicita a ferramenta local permitida (mode: ANY)
  const initialUserPrompt = buildAnalystToolPrompt(plan);
  recordStage('Analista: consulta de critério');

  const toolTurnCandidate = extractPrimaryCandidate(
    await invokeModel({
      systemInstruction: systemInstruction(ANALYST_SYSTEM_PROMPT),
      contents: [{ role: 'user', parts: [{ text: initialUserPrompt }] }],
      tools: [{ functionDeclarations: [toolDeclaration] }],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [TOOL_NAME],
        },
      },
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.3,
      },
    }),
  );

  const toolCallParts = toolTurnCandidate.content.parts.filter(
    (part) => part.functionCall !== undefined,
  );
  if (toolCallParts.length !== 1) {
    throw new Error('Solicitação de ferramenta inválida');
  }

  const functionCall = functionCallSchema.parse(toolCallParts[0].functionCall);
  const toolResult = runTool(functionCall.name, functionCall.args);

  recordStage(`Ferramenta local: critério fictício consultado (${toolResult.tema})`);

  // Chamada 2: Analista produz análise estruturada usando histórico completo e functionResponse
  const conversationHistory = [
    { role: 'user', parts: [{ text: initialUserPrompt }] },
    { role: 'model', parts: toolTurnCandidate.content.parts },
    {
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: functionCall.name,
            id: functionCall.id,
            response: toolResult,
          },
        },
      ],
    },
  ];

  recordStage('Analista: análise estruturada');
  let analysis: Analyst = analystSchema.parse(
    extractStructuredJson(
      await invokeModel({
        systemInstruction: systemInstruction(ANALYST_SYSTEM_PROMPT),
        contents: conversationHistory,
        generationConfig: jsonGenerationConfig(analystJSON),
      }),
    ),
  );

  const ferramentaDetalhes = {
    nome: TOOL_NAME,
    tema: toolResult.tema,
    natureza: TOOL_NATURE,
  };

  // Chamada 3: Revisor Crítico independente
  recordStage('Revisor: conferência crítica');
  let critique: Critic;
  try {
    critique = criticSchema.parse(
      extractStructuredJson(
        await invokeModel({
          systemInstruction: systemInstruction(CRITIC_SYSTEM_PROMPT),
          contents: [{ role: 'user', parts: [{ text: buildCriticPrompt(plan, analysis) }] }],
          generationConfig: jsonGenerationConfig(criticJSON),
        }),
      ),
    );
  } catch (error) {
    if (signal.aborted) throw error;
    recordStage('Revisor indisponível: resultado com ressalva');
    return multiResultSchema.parse({
      analise: analysis,
      ressalvas: ['A revisão crítica não foi concluída; verifique toda a análise.'],
      estado: 'com_ressalvas',
      etapas,
      chamadas: calls,
      ferramenta: true,
      ferramentaDetalhes,
    });
  }

  let estado: MultiResult['estado'] = 'consolidado';
  let ressalvas: string[] = [...critique.problemas];

  // Chamada 4 (condicional): no máximo uma revisão adicional quando decisão === REVISAR
  if (critique.decisao === 'REVISAR') {
    recordStage('Orquestrador: solicitada uma revisão');
    try {
      analysis = analystSchema.parse(
        extractStructuredJson(
          await invokeModel({
            systemInstruction: systemInstruction(ANALYST_SYSTEM_PROMPT),
            contents: [
              {
                role: 'user',
                parts: [{ text: buildAnalystRevisionPrompt(plan, analysis, critique) }],
              },
            ],
            generationConfig: jsonGenerationConfig(analystJSON),
          }),
        ),
      );
      estado = 'revisado_sem_reavaliacao';
      ressalvas = [
        ...critique.problemas,
        'A versão revisada não passou por nova revisão automática.',
      ];
    } catch (error) {
      if (signal.aborted) throw error;
      estado = 'com_ressalvas';
      ressalvas = [
        ...critique.problemas,
        'A revisão adicional falhou; confira a análise original.',
      ];
    }
  } else if (critique.decisao === 'RESSALVAS' || critique.problemas.length > 0) {
    estado = 'com_ressalvas';
    if (ressalvas.length === 0) {
      ressalvas = ['A revisão apontou incerteza sem detalhes; confira a análise.'];
    }
  }

  recordStage('Orquestrador: resultado consolidado');
  return multiResultSchema.parse({
    analise: analysis,
    ressalvas,
    estado,
    etapas,
    chamadas: calls,
    ferramenta: true,
    ferramentaDetalhes,
  });
}
