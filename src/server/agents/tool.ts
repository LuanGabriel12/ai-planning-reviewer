import { TOOL_THEMES, toolArgsSchema, type ToolTheme } from '../../schemas/multi';

export const TOOL_NAME = 'consultar_criterio_ficticio' as const;
export const TOOL_NATURE = 'exemplo fictício, não é norma' as const;

export const toolArgs = toolArgsSchema;

export const toolDeclaration = {
  name: TOOL_NAME,
  description:
    'Consulta exemplos locais e fictícios de perguntas de revisão pedagógica (não representam normas oficiais de educação).',
  parameters: {
    type: 'OBJECT',
    properties: {
      tema: {
        type: 'STRING',
        enum: [...TOOL_THEMES],
      },
    },
    required: ['tema'],
  },
} as const;

const FICTITIOUS_CRITERIA: Record<ToolTheme, string> = {
  objetivos:
    'Exemplo: os objetivos identificam uma aprendizagem observável, compatível com a etapa informada?',
  atividades:
    'Exemplo: as atividades permitem praticar a aprendizagem pretendida com clareza de dinâmica e recursos?',
  avaliacao:
    'Exemplo: a avaliação descreve evidências e critérios relacionados diretamente aos objetivos?',
  alinhamento:
    'Exemplo: objetivos, atividades e avaliação se relacionam explicitamente entre si sem lacunas ou contradições?',
};

export interface ToolExecutionOutput {
  tema: ToolTheme;
  criterio: string;
  natureza: typeof TOOL_NATURE;
}

/**
 * Executa exclusivamente a consulta local autorizada em allowlist.
 * Não acessa arquivos, terminal, rede, variáveis de ambiente ou serviços externos.
 */
export function runTool(name: string, args: unknown): ToolExecutionOutput {
  if (name !== TOOL_NAME) {
    throw new Error('Ferramenta não autorizada');
  }

  const parsed = toolArgsSchema.parse(args);
  return {
    tema: parsed.tema,
    criterio: FICTITIOUS_CRITERIA[parsed.tema],
    natureza: TOOL_NATURE,
  };
}
