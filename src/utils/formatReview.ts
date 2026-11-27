import {
  streamEventSchema,
  type MultiResult,
  type MultiStatus,
  type StreamEvent,
} from '../schemas/multi';
import { apiErrorSchema, type Review } from '../schemas/plan';

export const MAX_STREAM_BYTES = 100_000;

export function formatSingleReviewText(review: Review): string {
  return [
    'PONTOS FORTES',
    ...review.pontosFortes.map((item) => `• ${item}`),
    '',
    'POSSÍVEIS INCONSISTÊNCIAS',
    ...review.inconsistencias.map((item) => `• ${item}`),
    '',
    'SUGESTÕES DE MELHORIA',
    ...review.sugestoes.map((item) => `• ${item}`),
  ].join('\n');
}

export function formatMultiReviewText(result: MultiResult): string {
  const sections = [
    formatSingleReviewText(result.analise),
    '',
    'FATOS INFORMADOS',
    ...(result.analise.fatosInformados.length > 0
      ? result.analise.fatosInformados.map((item) => `• ${item}`)
      : ['• Nenhum fato adicional listado.']),
    '',
    'INFERÊNCIAS E SUPOSIÇÕES',
    ...(result.analise.inferencias.length > 0
      ? result.analise.inferencias.map((item) => `• ${item}`)
      : ['• Nenhuma inferência registrada.']),
  ];

  if (result.ressalvas.length > 0) {
    sections.push('', 'RESSALVAS', ...result.ressalvas.map((item) => `• ${item}`));
  }

  return sections.join('\n');
}

export interface StatusDescriptor {
  label: string;
  tone: 'success' | 'warning';
  summary: string;
}

export function describeMultiStatus(status: MultiStatus): StatusDescriptor {
  switch (status) {
    case 'consolidado':
      return {
        label: 'Concluída (consolidada)',
        tone: 'success',
        summary:
          'O revisor crítico não apontou impedimentos estruturais relevantes; a validação humana continua indispensável.',
      };
    case 'revisado_sem_reavaliacao':
      return {
        label: 'Revisada sem nova reavaliação',
        tone: 'warning',
        summary:
          'O analista aplicou uma revisão adicional solicitada pelo revisor, sem nova verificação automática devido ao limite de 4 chamadas.',
      };
    case 'com_ressalvas':
      return {
        label: 'Concluída com ressalvas',
        tone: 'warning',
        summary:
          'Foram registradas ressalvas pelo revisor ou por indisponibilidade parcial; revise cada ponto com atenção.',
      };
  }
}

export async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const raw: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data.error;
    }
    if (raw && typeof raw === 'object' && 'error' in raw && typeof raw.error === 'string' && raw.error.trim()) {
      return raw.error;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export async function readNdjsonStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
  maxBytes = MAX_STREAM_BYTES,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let totalBytes = 0;

  const processLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) return;
    const parsedEvent = streamEventSchema.parse(JSON.parse(line));
    onEvent(parsedEvent);
  };

  while (true) {
    const part = await reader.read();
    if (part.done) break;
    totalBytes += part.value.length;
    if (totalBytes > maxBytes) {
      await reader.cancel?.();
      throw new Error('Resposta excedeu o limite.');
    }

    pending += decoder.decode(part.value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newlineIndex);
      pending = pending.slice(newlineIndex + 1);
      processLine(line);
    }
  }

  pending += decoder.decode();
  if (pending.trim()) {
    processLine(pending);
  }
}
