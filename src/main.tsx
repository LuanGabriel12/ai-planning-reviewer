import React, { useRef, useState } from 'react';
import { z } from 'zod';
import { PlanForm } from './components/PlanForm';
import { ResultPanel, type StructuredOutput } from './components/ResultPanel';
import { EMPTY_PLAN } from './data/examples';
import type { MultiResult } from './schemas/multi';
import { planSchema, reviewSchema, type Plan } from './schemas/plan';
import {
  extractErrorMessage,
  formatMultiReviewText,
  formatSingleReviewText,
  readNdjsonStream,
} from './utils/formatReview';
import './style.css';

export function App() {
  const [plan, setPlan] = useState<Plan>(EMPTY_PLAN);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [structured, setStructured] = useState<StructuredOutput | null>(null);
  const [resultText, setResultText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [copied, setCopied] = useState(false);
  const [multi, setMulti] = useState(false);
  const [progress, setProgress] = useState('');
  const [trace, setTrace] = useState<string[]>([]);

  const requestRef = useRef<AbortController | null>(null);

  function clearFeedback() {
    setError('');
    setStructured(null);
    setResultText('');
    setOriginalText('');
    setTrace([]);
    setProgress('');
    setCopied(false);
  }

  function handleSelectExample(examplePlan: Plan) {
    setPlan(examplePlan);
    clearFeedback();
  }

  function handleClearForm() {
    setPlan(EMPTY_PLAN);
    clearFeedback();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    clearFeedback();

    const validation = planSchema.safeParse(plan);
    if (!validation.success) {
      setError(
        'Preencha todos os campos: disciplina e ano precisam de pelo menos 2 caracteres; objetivos, atividades e avaliação precisam de pelo menos 10.',
      );
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const endpoint = multi ? '/api/multi' : '/api/analyze';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response, 'Não foi possível analisar.');
        throw new Error(message);
      }

      if (multi) {
        if (!response.body) {
          throw new Error('Resposta sem conteúdo.');
        }

        let finalResult: MultiResult | undefined;

        await readNdjsonStream(response.body, (streamEvent) => {
          if (streamEvent.tipo === 'etapa') {
            setProgress(streamEvent.etapa);
            setTrace((previous) => [...previous, streamEvent.etapa]);
          } else if (streamEvent.tipo === 'erro') {
            throw new Error(streamEvent.mensagem);
          } else {
            finalResult = streamEvent.resultado;
          }
        });

        if (!finalResult) {
          throw new Error('A análise não foi concluída.');
        }

        const formatted = formatMultiReviewText(finalResult);
        setStructured({ mode: 'multi', result: finalResult });
        setResultText(formatted);
        setOriginalText(formatted);

        const toolSummary = finalResult.ferramentaDetalhes
          ? `Ferramenta local: ${finalResult.ferramentaDetalhes.nome} (${finalResult.ferramentaDetalhes.tema} — ${finalResult.ferramentaDetalhes.natureza})`
          : `Ferramenta local: ${finalResult.ferramenta ? 'utilizada' : 'não utilizada'}`;

        setTrace([
          ...finalResult.etapas,
          `Chamadas ao modelo: ${finalResult.chamadas}`,
          toolSummary,
          `Estado: ${finalResult.estado}`,
          ...finalResult.ressalvas.map((item) => `Ressalva: ${item}`),
        ]);
      } else {
        const review = reviewSchema.parse(await response.json());
        const formatted = formatSingleReviewText(review);
        setStructured({ mode: 'single', review });
        setResultText(formatted);
        setOriginalText(formatted);
        setTrace([
          'Modo: agente único',
          'Chamadas ao modelo: 1',
          'Validação estrutural Zod: aprovada',
        ]);
      }
    } catch (caught) {
      if (controller.signal.aborted) {
        setError('Análise cancelada.');
      } else if (caught instanceof z.ZodError) {
        setError('A resposta recebida não passou na validação.');
      } else if (caught instanceof Error) {
        setError(caught.message);
      } else {
        setError('Erro de conexão.');
      }
    } finally {
      requestRef.current = null;
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(resultText);
      setCopied(true);
    } catch {
      setError('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  }

  return (
    <>
      <header>
        <div className="brand">
          <span className="brandmark" aria-hidden="true">
            ✳
          </span>
          <span>
            AI Planning <b>Reviewer</b>
          </span>
        </div>
        <span className="badge">DEMONSTRAÇÃO LOCAL · DADOS FICTÍCIOS</span>
      </header>

      <main>
        <section className="intro">
          <div className="eyebrow">
            <span aria-hidden="true" /> ASSISTENTE DE REFLEXÃO PEDAGÓGICA
          </div>
          <h1>
            Boas ideias merecem
            <br />
            <em>um novo olhar.</em>
          </h1>
          <p>
            Protótipo de engenharia de aplicações com LLM para apoiar a reflexão sobre
            planejamentos pedagógicos fictícios — comparando modo agente único e orquestração
            multiagente com function calling e validação Zod.
          </p>
          <div className="notice" role="note">
            <strong>↗ &nbsp; Antes de começar</strong>
            <br />
            Use somente informações fictícias. Não inclua nomes, dados pessoais ou informações de
            escolas reais. Este sistema não aprova nem reprova planejamentos.
          </div>
        </section>

        <div className="workspace">
          <PlanForm
            plan={plan}
            multi={multi}
            loading={loading}
            error={error}
            onChangePlan={setPlan}
            onSelectExample={handleSelectExample}
            onClear={handleClearForm}
            onToggleMulti={setMulti}
            onSubmit={handleSubmit}
            onCancel={() => requestRef.current?.abort()}
          />

          <ResultPanel
            loading={loading}
            multi={multi}
            progress={progress}
            structured={structured}
            editableText={resultText}
            originalText={originalText}
            trace={trace}
            copied={copied}
            onChangeText={(nextText) => {
              setResultText(nextText);
              setCopied(false);
            }}
            onResetText={() => {
              setResultText(originalText);
              setCopied(false);
            }}
            onCopy={handleCopy}
          />
        </div>

        <footer>
          <span>✳ &nbsp; AI Planning Reviewer V2</span>
          <span>Feito para apoiar a reflexão, não para tomar decisões ou substituir educadores.</span>
        </footer>
      </main>
    </>
  );
}
