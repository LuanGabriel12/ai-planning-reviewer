import React from 'react';
import type { MultiResult } from '../schemas/multi';
import type { Review } from '../schemas/plan';
import { describeMultiStatus } from '../utils/formatReview';

export type StructuredOutput =
  | { mode: 'single'; review: Review }
  | { mode: 'multi'; result: MultiResult };

export interface ResultPanelProps {
  loading: boolean;
  multi: boolean;
  progress: string;
  structured: StructuredOutput | null;
  editableText: string;
  originalText: string;
  trace: string[];
  copied: boolean;
  onChangeText: (nextText: string) => void;
  onResetText: () => void;
  onCopy: () => void;
}

export function ResultPanel({
  loading,
  multi,
  progress,
  structured,
  editableText,
  originalText,
  trace,
  copied,
  onChangeText,
  onResetText,
  onCopy,
}: ResultPanelProps) {
  const isEdited = Boolean(originalText) && editableText !== originalText;
  const multiStatus =
    structured?.mode === 'multi' ? describeMultiStatus(structured.result.estado) : null;

  return (
    <section className="card result" aria-labelledby="result-heading">
      <span className="step">02 / ANÁLISE</span>
      <h2 id="result-heading">Seu novo olhar</h2>
      <p>Revise os pontos levantados, avalie criticamente cada sugestão e adapte ao seu contexto.</p>

      {loading ? (
        <div className="empty" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <strong>
            {multi
              ? progress || 'Iniciando orquestração multiagente…'
              : 'Consultando o modelo em chamada única…'}
          </strong>
          <span>
            {multi
              ? 'Etapas exibidas aqui correspondem aos eventos reais enviados pelo servidor.'
              : 'No modo agente único não há streaming de etapas intermediárias.'}
          </span>
        </div>
      ) : editableText ? (
        <div className="result-content">
          {structured && (
            <div className="meta-bar" aria-label="Resumo técnico da execução">
              <span className="meta-pill">
                Modo: {structured.mode === 'multi' ? 'Multiagente' : 'Agente único'}
              </span>
              <span className="meta-pill">
                Chamadas ao modelo: {structured.mode === 'multi' ? structured.result.chamadas : 1}
              </span>
              {structured.mode === 'multi' && multiStatus && (
                <span className={`meta-pill meta-${multiStatus.tone}`}>
                  Estado: {multiStatus.label}
                </span>
              )}
              {structured.mode === 'multi' && structured.result.ferramenta && (
                <span className="meta-pill">
                  Ferramenta:{' '}
                  {structured.result.ferramentaDetalhes
                    ? `${structured.result.ferramentaDetalhes.nome} (${structured.result.ferramentaDetalhes.tema} — fictício)`
                    : 'critério fictício local'}
                </span>
              )}
            </div>
          )}

          {structured?.mode === 'multi' && structured.result.ressalvas.length > 0 && (
            <div className="caveat-box" role="note">
              <strong>Ressalvas registradas</strong>
              <ul>
                {structured.result.ressalvas.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {structured && (
            <div className="structured-grid" aria-label="Resultado estruturado da análise">
              <article className="section-box section-strengths">
                <h3>Pontos fortes</h3>
                <ul>
                  {(structured.mode === 'multi'
                    ? structured.result.analise.pontosFortes
                    : structured.review.pontosFortes
                  ).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="section-box section-gaps">
                <h3>Possíveis inconsistências</h3>
                <ul>
                  {(structured.mode === 'multi'
                    ? structured.result.analise.inconsistencias
                    : structured.review.inconsistencias
                  ).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="section-box section-suggestions">
                <h3>Sugestões de melhoria</h3>
                <ul>
                  {(structured.mode === 'multi'
                    ? structured.result.analise.sugestoes
                    : structured.review.sugestoes
                  ).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </article>

              {structured.mode === 'multi' && (
                <div className="facts-split">
                  <article className="section-box section-facts">
                    <h3>Fatos informados no planejamento</h3>
                    <ul>
                      {structured.result.analise.fatosInformados.length > 0 ? (
                        structured.result.analise.fatosInformados.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))
                      ) : (
                        <li>Nenhum fato adicional destacado.</li>
                      )}
                    </ul>
                  </article>

                  <article className="section-box section-inferences">
                    <h3>Inferências e suposições</h3>
                    <ul>
                      {structured.result.analise.inferencias.length > 0 ? (
                        structured.result.analise.inferencias.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))
                      ) : (
                        <li>Nenhuma inferência registrada.</li>
                      )}
                    </ul>
                  </article>
                </div>
              )}
            </div>
          )}

          <div className="editor-block">
            <div className="editor-header">
              <label className="resultlabel" htmlFor="review">
                Análise editável
              </label>
              {isEdited && (
                <button type="button" className="text-link" onClick={onResetText}>
                  Restaurar texto gerado
                </button>
              )}
            </div>
            <textarea
              id="review"
              className="review"
              value={editableText}
              onChange={(event) => onChangeText(event.target.value)}
            />
            <div className="action-row">
              <button type="button" className="copy" onClick={onCopy}>
                {copied ? 'Copiado ✓' : 'Copiar sugestões ↗'}
              </button>
              {isEdited && <span className="edited-badge">Editado localmente</span>}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty">
          <div className="emptyicon" aria-hidden="true">
            ✳
          </div>
          <strong>Sua análise aparecerá aqui</strong>
          <span>
            Preencha o planejamento fictício ao lado ou experimente um dos exemplos disponíveis.
          </span>
        </div>
      )}

      {trace.length > 0 && (
        <div className="trace-box" aria-live="polite">
          <strong>Caminho da análise</strong>
          <ul>
            {trace.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="disclaimer">
        <strong>Uma ferramenta de apoio.</strong> As sugestões são geradas por IA, podem conter
        erros ou suposições não confirmadas, não aprovam nem reprovam planejamentos e não
        substituem a avaliação de uma pessoa educadora.
      </div>
    </section>
  );
}
