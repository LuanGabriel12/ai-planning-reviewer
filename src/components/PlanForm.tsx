import React from 'react';
import { DEFAULT_EXAMPLE_PLAN, EXAMPLE_PRESETS } from '../data/examples';
import { PLAN_LIMITS, type Plan } from '../schemas/plan';

interface FieldConfig {
  key: keyof Plan;
  label: string;
  placeholder: string;
  min: number;
  max: number;
  multiline: boolean;
}

const PLAN_FIELDS: FieldConfig[] = [
  {
    key: 'disciplina',
    label: 'Disciplina',
    placeholder: 'Ex.: Ciências da Natureza',
    min: PLAN_LIMITS.disciplina.min,
    max: PLAN_LIMITS.disciplina.max,
    multiline: false,
  },
  {
    key: 'ano',
    label: 'Ano escolar',
    placeholder: 'Ex.: 6º ano do ensino fundamental',
    min: PLAN_LIMITS.ano.min,
    max: PLAN_LIMITS.ano.max,
    multiline: false,
  },
  {
    key: 'objetivos',
    label: 'Objetivos de aprendizagem',
    placeholder: 'O que se espera que a turma aprenda ao final da aula ou sequência?',
    min: PLAN_LIMITS.objetivos.min,
    max: PLAN_LIMITS.objetivos.max,
    multiline: true,
  },
  {
    key: 'atividades',
    label: 'Atividades propostas',
    placeholder: 'Como os objetivos serão trabalhados na prática com a turma?',
    min: PLAN_LIMITS.atividades.min,
    max: PLAN_LIMITS.atividades.max,
    multiline: true,
  },
  {
    key: 'avaliacao',
    label: 'Metodologia de avaliação',
    placeholder: 'Como a aprendizagem será acompanhada e quais evidências serão observadas?',
    min: PLAN_LIMITS.avaliacao.min,
    max: PLAN_LIMITS.avaliacao.max,
    multiline: true,
  },
];

export interface PlanFormProps {
  plan: Plan;
  multi: boolean;
  loading: boolean;
  error: string;
  onChangePlan: (nextPlan: Plan) => void;
  onSelectExample: (examplePlan: Plan) => void;
  onClear: () => void;
  onToggleMulti: (enabled: boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

export function PlanForm({
  plan,
  multi,
  loading,
  error,
  onChangePlan,
  onSelectExample,
  onClear,
  onToggleMulti,
  onSubmit,
  onCancel,
}: PlanFormProps) {
  const hasContent = Object.values(plan).some((value) => value.trim().length > 0);

  return (
    <section className="card" aria-labelledby="form-heading">
      <div className="cardhead">
        <div>
          <span className="step">01 / PLANEJAMENTO</span>
          <h2 id="form-heading">Conte sobre sua aula</h2>
          <p>Preencha os campos fictícios para receber uma revisão estruturada de apoio.</p>
        </div>
        <button
          className="example"
          type="button"
          disabled={loading}
          onClick={() => onSelectExample(DEFAULT_EXAMPLE_PLAN)}
        >
          Usar exemplo fictício ↗
        </button>
      </div>

      <div className="presets" role="group" aria-label="Exemplos fictícios adicionais">
        <span className="presets-label">Outros casos fictícios:</span>
        <div className="presets-list">
          {EXAMPLE_PRESETS.slice(1).map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset-chip"
              disabled={loading}
              title={preset.description}
              onClick={() => onSelectExample(preset.plan)}
            >
              {preset.label}
            </button>
          ))}
          {hasContent && (
            <button
              type="button"
              className="preset-chip preset-clear"
              disabled={loading}
              onClick={onClear}
            >
              Limpar campos
            </button>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <div className="mode-panel">
          <label className="mode">
            <input
              type="checkbox"
              checked={multi}
              disabled={loading}
              onChange={(event) => onToggleMulti(event.target.checked)}
            />
            <span>
              Usar análise multiagente (analista + ferramenta local + revisor crítico, até 4 chamadas à IA)
            </span>
          </label>
          <p className="mode-hint">
            {multi
              ? 'Modo multiagente ativo: etapas reais são enviadas pelo servidor em NDJSON, com consulta a critério fictício local e revisão crítica.'
              : 'Modo agente único ativo: envia uma única chamada estruturada ao modelo sem etapas intermediárias.'}
          </p>
        </div>

        <fieldset disabled={loading} className="formgrid">
          {PLAN_FIELDS.map((field) => {
            const value = plan[field.key];
            const remainingWarning = value.length > field.max * 0.9;
            return (
              <label
                className={field.multiline ? 'wide' : undefined}
                key={field.key}
              >
                <span>
                  {field.label} <i aria-hidden="true">*</i>
                </span>
                {field.multiline ? (
                  <textarea
                    rows={3}
                    value={value}
                    maxLength={field.max}
                    placeholder={field.placeholder}
                    required
                    onChange={(event) =>
                      onChangePlan({ ...plan, [field.key]: event.target.value })
                    }
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    maxLength={field.max}
                    placeholder={field.placeholder}
                    required
                    onChange={(event) =>
                      onChangePlan({ ...plan, [field.key]: event.target.value })
                    }
                  />
                )}
                <small className={remainingWarning ? 'counter-warn' : undefined}>
                  mín. {field.min} · {value.length} / {field.max}
                </small>
              </label>
            );
          })}
        </fieldset>

        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}

        <div className="submitrow">
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Analisando…' : '✳  Analisar com IA'} <span aria-hidden="true">→</span>
          </button>
          {loading && (
            <button type="button" className="secondary" onClick={onCancel}>
              Cancelar
            </button>
          )}
          <small>
            {multi
              ? 'Até 4 chamadas sequenciais; você pode cancelar a qualquer momento.'
              : 'A análise em chamada única pode levar alguns segundos.'}
          </small>
        </div>
      </form>
    </section>
  );
}
