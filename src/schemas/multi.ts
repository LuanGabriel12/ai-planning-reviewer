import { z } from 'zod';
import { REVIEW_LIMITS, reviewSchema } from './plan';

export const TOOL_THEMES = ['objetivos', 'atividades', 'avaliacao', 'alinhamento'] as const;
export type ToolTheme = (typeof TOOL_THEMES)[number];

export const toolArgsSchema = z
  .object({
    tema: z.enum(TOOL_THEMES),
  })
  .strict();

export type ToolArgs = z.infer<typeof toolArgsSchema>;

export const functionCallSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    args: z.unknown(),
    id: z.string().trim().min(1).max(200),
  })
  .strict();

export type FunctionCallPayload = z.infer<typeof functionCallSchema>;

export const geminiPartSchema = z.record(z.string(), z.unknown());

export const geminiEnvelopeSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            role: z.string().optional(),
            parts: z.array(geminiPartSchema).max(8).optional(),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .min(1),
});

export type GeminiEnvelope = z.infer<typeof geminiEnvelopeSchema>;

export const analystSchema = reviewSchema
  .extend({
    fatosInformados: z.array(z.string().trim().min(1).max(400)).max(4),
    inferencias: z.array(z.string().trim().min(1).max(400)).max(4),
  })
  .strict();

export type Analyst = z.infer<typeof analystSchema>;

export const criticSchema = z
  .object({
    decisao: z.enum(['CONSOLIDAR', 'REVISAR', 'RESSALVAS']),
    problemas: z.array(z.string().trim().min(1).max(500)).max(4),
    orientacao: z.string().trim().max(800),
  })
  .strict();

export type Critic = z.infer<typeof criticSchema>;

export const toolDetailsSchema = z
  .object({
    nome: z.literal('consultar_criterio_ficticio'),
    tema: z.enum(TOOL_THEMES),
    natureza: z.string().trim().min(1).max(120),
  })
  .strict();

export type ToolDetails = z.infer<typeof toolDetailsSchema>;

export const multiStatusSchema = z.enum([
  'consolidado',
  'revisado_sem_reavaliacao',
  'com_ressalvas',
]);

export type MultiStatus = z.infer<typeof multiStatusSchema>;

export const multiResultSchema = z
  .object({
    analise: analystSchema,
    ressalvas: z.array(z.string().trim().min(1).max(500)).max(8),
    estado: multiStatusSchema,
    etapas: z.array(z.string().trim().min(1).max(120)).max(12),
    chamadas: z.number().int().min(1).max(4),
    ferramenta: z.boolean(),
    ferramentaDetalhes: toolDetailsSchema.optional(),
  })
  .strict();

export type MultiResult = z.infer<typeof multiResultSchema>;

export const streamEventSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('etapa'),
    etapa: z.string().trim().min(1).max(120),
  }),
  z.object({
    tipo: z.literal('erro'),
    mensagem: z.string().trim().min(1).max(300),
  }),
  z.object({
    tipo: z.literal('resultado'),
    resultado: multiResultSchema,
  }),
]);

export type StreamEvent = z.infer<typeof streamEventSchema>;

export const analystJSON = {
  type: 'object',
  properties: {
    pontosFortes: {
      type: 'array',
      minItems: REVIEW_LIMITS.minItems,
      maxItems: REVIEW_LIMITS.maxItems,
      items: { type: 'string', minLength: 1, maxLength: REVIEW_LIMITS.maxItemLength },
    },
    inconsistencias: {
      type: 'array',
      minItems: REVIEW_LIMITS.minItems,
      maxItems: REVIEW_LIMITS.maxItems,
      items: { type: 'string', minLength: 1, maxLength: REVIEW_LIMITS.maxItemLength },
    },
    sugestoes: {
      type: 'array',
      minItems: REVIEW_LIMITS.minItems,
      maxItems: REVIEW_LIMITS.maxItems,
      items: { type: 'string', minLength: 1, maxLength: REVIEW_LIMITS.maxItemLength },
    },
    fatosInformados: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', minLength: 1, maxLength: 400 },
    },
    inferencias: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', minLength: 1, maxLength: 400 },
    },
  },
  required: ['pontosFortes', 'inconsistencias', 'sugestoes', 'fatosInformados', 'inferencias'],
} as const;

export const criticJSON = {
  type: 'object',
  properties: {
    decisao: {
      type: 'string',
      enum: ['CONSOLIDAR', 'REVISAR', 'RESSALVAS'],
    },
    problemas: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', minLength: 1, maxLength: 500 },
    },
    orientacao: {
      type: 'string',
      maxLength: 800,
    },
  },
  required: ['decisao', 'problemas', 'orientacao'],
} as const;
