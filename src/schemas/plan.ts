import { z } from 'zod';

export const MAX_PLAN_PAYLOAD_BYTES = 12_000;

export const PLAN_LIMITS = {
  disciplina: { min: 2, max: 120 },
  ano: { min: 2, max: 120 },
  objetivos: { min: 10, max: 1200 },
  atividades: { min: 10, max: 1800 },
  avaliacao: { min: 10, max: 1200 },
} as const;

export const REVIEW_LIMITS = {
  minItems: 1,
  maxItems: 5,
  maxItemLength: 700,
} as const;

const boundedText = (min: number, max: number) => z.string().trim().min(min).max(max);

export const planSchema = z
  .object({
    disciplina: boundedText(PLAN_LIMITS.disciplina.min, PLAN_LIMITS.disciplina.max),
    ano: boundedText(PLAN_LIMITS.ano.min, PLAN_LIMITS.ano.max),
    objetivos: boundedText(PLAN_LIMITS.objetivos.min, PLAN_LIMITS.objetivos.max),
    atividades: boundedText(PLAN_LIMITS.atividades.min, PLAN_LIMITS.atividades.max),
    avaliacao: boundedText(PLAN_LIMITS.avaliacao.min, PLAN_LIMITS.avaliacao.max),
  })
  .strict();

export type Plan = z.infer<typeof planSchema>;

const reviewItemList = z
  .array(boundedText(1, REVIEW_LIMITS.maxItemLength))
  .min(REVIEW_LIMITS.minItems)
  .max(REVIEW_LIMITS.maxItems);

export const reviewSchema = z
  .object({
    pontosFortes: reviewItemList,
    inconsistencias: reviewItemList,
    sugestoes: reviewItemList,
  })
  .strict();

export type Review = z.infer<typeof reviewSchema>;

export const apiErrorSchema = z
  .object({
    error: z.string().trim().min(1).max(400),
    code: z.string().trim().min(1).max(60).optional(),
  })
  .strict();

export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;

export const responseJsonSchema = {
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
  },
  required: ['pontosFortes', 'inconsistencias', 'sugestoes'],
} as const;
