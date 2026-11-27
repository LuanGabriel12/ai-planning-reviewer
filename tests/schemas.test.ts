import { describe, expect, it } from 'vitest';
import casesDataset from '../experiments/cases.json';
import evalScriptSource from '../experiments/run-evaluation.mjs?raw';
import {
  analystSchema,
  criticSchema,
  multiResultSchema,
  streamEventSchema,
  toolArgsSchema,
} from '../src/schemas/multi';
import { apiErrorSchema, planSchema, reviewSchema } from '../src/schemas/plan';

const validPlan = {
  disciplina: 'Ciências',
  ano: '6º ano',
  objetivos: 'Identificar evaporação e condensação no ciclo da água.',
  atividades: 'Observar recipiente com água morna em grupos e desenhar o ciclo.',
  avaliacao: 'Analisar o desenho e ouvir explicação individual de cada estudante.',
};

describe('schemas Zod — validação rigorosa de entrada e saída', () => {
  it('rejeita strings vazias ou apenas com espaços em branco', () => {
    expect(planSchema.safeParse({ ...validPlan, disciplina: '   ' }).success).toBe(false);
    expect(planSchema.safeParse({ ...validPlan, objetivos: '          ' }).success).toBe(false);
    expect(
      reviewSchema.safeParse({
        pontosFortes: ['   '],
        inconsistencias: ['Falta tempo'],
        sugestoes: ['Definir tempo'],
      }).success,
    ).toBe(false);
    expect(
      analystSchema.safeParse({
        pontosFortes: ['Claro'],
        inconsistencias: ['Sem tempo'],
        sugestoes: ['Incluir tempo'],
        fatosInformados: ['   '],
        inferencias: [],
      }).success,
    ).toBe(false);
    expect(
      criticSchema.safeParse({
        decisao: 'RESSALVAS',
        problemas: ['   '],
        orientacao: 'Revisar',
      }).success,
    ).toBe(false);
  });

  it('rejeita tipos incorretos, campos extras e arrays acima do limite', () => {
    expect(planSchema.safeParse({ ...validPlan, ano: 6 }).success).toBe(false);
    expect(
      reviewSchema.safeParse({
        pontosFortes: ['1', '2', '3', '4', '5', '6'],
        inconsistencias: ['a'],
        sugestoes: ['b'],
      }).success,
    ).toBe(false);
    expect(
      reviewSchema.safeParse({
        pontosFortes: ['a'.repeat(701)],
        inconsistencias: ['a'],
        sugestoes: ['b'],
      }).success,
    ).toBe(false);
    expect(
      criticSchema.safeParse({
        decisao: 'APROVAR',
        problemas: [],
        orientacao: '',
      }).success,
    ).toBe(false);
    expect(toolArgsSchema.safeParse({ tema: 'bncc' }).success).toBe(false);
    expect(apiErrorSchema.safeParse({ error: '' }).success).toBe(false);
  });

  it('valida eventos NDJSON e rejeita estruturas malformadas', () => {
    expect(streamEventSchema.safeParse({ tipo: 'etapa', etapa: 'Analista' }).success).toBe(true);
    expect(streamEventSchema.safeParse({ tipo: 'erro', mensagem: 'Falha' }).success).toBe(true);
    expect(streamEventSchema.safeParse({ tipo: 'pensamento', texto: 'secreto' }).success).toBe(
      false,
    );
  });

  it('valida resultado multiagente com e sem ferramentaDetalhes e impõe teto de 4 chamadas', () => {
    const base = {
      analise: {
        pontosFortes: ['Objetivo claro'],
        inconsistencias: ['Falta duração'],
        sugestoes: ['Definir duração'],
        fatosInformados: ['Atividade em grupo'],
        inferencias: ['Pode precisar de 50 min'],
      },
      ressalvas: [],
      estado: 'consolidado' as const,
      etapas: ['Analista: consulta de critério'],
      chamadas: 3,
      ferramenta: true,
    };

    expect(multiResultSchema.safeParse(base).success).toBe(true);
    expect(
      multiResultSchema.safeParse({
        ...base,
        ferramentaDetalhes: {
          nome: 'consultar_criterio_ficticio',
          tema: 'alinhamento',
          natureza: 'exemplo fictício, não é norma',
        },
      }).success,
    ).toBe(true);
    expect(multiResultSchema.safeParse({ ...base, chamadas: 5 }).success).toBe(false);
  });

  it('garante que todos os 12 casos fictícios da metodologia de avaliação são válidos', () => {
    expect(casesDataset.cases.length).toBe(12);
    for (const item of casesDataset.cases) {
      const check = planSchema.safeParse(item.plan);
      expect(check.success, `Caso ${item.id} deveria passar no planSchema`).toBe(true);
    }
  });

  it('garante que experiments/run-evaluation.mjs reutiliza src/schemas/plan.ts sem duplicar schema', () => {
    expect(evalScriptSource).toContain("from '../src/schemas/plan.ts'");
    expect(evalScriptSource).not.toContain('z.object(');
  });
});
