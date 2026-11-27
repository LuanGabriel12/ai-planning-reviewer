import { geminiEnvelopeSchema } from '../../schemas/multi';
import { readLimitedBody } from '../http';

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const MAX_PROVIDER_RESPONSE_BYTES = 64_000;
export const MAX_OUTPUT_TEXT_CHARS = 20_000;
export const SINGLE_CALL_TIMEOUT_MS = 25_000;
export const MULTI_CALL_TIMEOUT_MS = 20_000;
export const MULTI_TOTAL_TIMEOUT_MS = 75_000;
export const MAX_MULTI_CALLS = 4;

export type ProviderErrorKind =
  | 'rate_limit'
  | 'bad_request'
  | 'auth'
  | 'model_unavailable'
  | 'provider_http'
  | 'response_missing'
  | 'response_too_large'
  | 'invalid_provider_json'
  | 'invalid_envelope'
  | 'blocked_output'
  | 'malformed_function_call'
  | 'incomplete_output'
  | 'invalid_structured_json'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'call_limit';

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly httpStatus?: number;
  readonly userMessage: string;

  constructor(
    kind: ProviderErrorKind,
    message: string,
    userMessage: string,
    httpStatus?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.userMessage = userMessage;
    this.httpStatus = httpStatus;
  }
}

export function mapProviderHttpError(status: number): ProviderError {
  if (status === 429) {
    return new ProviderError(
      'rate_limit',
      'Limite do provedor atingido',
      'Limite do provedor atingido. Tente mais tarde.',
      status,
    );
  }
  if (status === 400) {
    return new ProviderError(
      'bad_request',
      'Falha do provedor HTTP 400',
      'O provedor recusou a solicitação (400).',
      status,
    );
  }
  if (status === 401 || status === 403) {
    return new ProviderError(
      'auth',
      `Falha do provedor HTTP ${status}`,
      'O provedor recusou a chave ou o acesso (autenticação).',
      status,
    );
  }
  if (status === 404) {
    return new ProviderError(
      'model_unavailable',
      'Falha do provedor HTTP 404',
      'O modelo configurado não está disponível para esta chave.',
      status,
    );
  }
  return new ProviderError(
    'provider_http',
    `Falha do provedor HTTP ${status}`,
    'Não foi possível consultar o provedor de IA.',
    status,
  );
}

export interface GeminiCallOptions {
  apiKey: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
  fetcher?: typeof fetch;
}

/**
 * Realiza uma única chamada HTTP POST ao endpoint REST do Gemini.
 * - Sem retries automáticos (evita amplificação de custo/cota).
 * - Autenticação exclusivamente via cabeçalho x-goog-api-key no servidor.
 * - Limita o corpo retornado a 64 KB antes do JSON.parse.
 * - Nunca inclui corpo bruto ou chave da API nas mensagens de erro.
 */
export async function callGemini({
  apiKey,
  body,
  signal,
  fetcher = fetch,
}: GeminiCallOptions): Promise<unknown> {
  const response = await fetcher(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw mapProviderHttpError(response.status);
  }

  const read = await readLimitedBody(response.body, MAX_PROVIDER_RESPONSE_BYTES);
  if (!read.ok) {
    if (read.reason === 'too_large') {
      throw new ProviderError(
        'response_too_large',
        'Resposta excessiva',
        'A resposta da IA excedeu o limite.',
      );
    }
    throw new ProviderError(
      'response_missing',
      'Resposta ausente',
      'A IA não retornou uma análise válida.',
    );
  }

  try {
    return JSON.parse(read.text);
  } catch {
    throw new ProviderError(
      'invalid_provider_json',
      'Resposta inválida do provedor',
      'Resposta inválida do provedor.',
    );
  }
}

const BLOCKED_FINISH_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
]);

const FUNCTION_CALL_ERROR_FINISH_REASONS = new Set([
  'MALFORMED_FUNCTION_CALL',
  'UNEXPECTED_TOOL_CALL',
  'TOO_MANY_TOOL_CALLS',
]);

export interface ValidatedGeminiCandidate {
  content: {
    role?: string;
    parts: Array<Record<string, unknown>>;
  };
  finishReason?: string;
}

/**
 * Política fail-closed de `finishReason` conforme a documentação oficial da Gemini API:
 * apenas ausência do campo (respostas/mocks mínimos) ou `STOP` são aceitos como término normal.
 * Respostas truncadas (`MAX_TOKENS`), chamadas malformadas (`MALFORMED_FUNCTION_CALL`),
 * bloqueios (`SAFETY`, `RECITATION`, `BLOCKLIST`, `PROHIBITED_CONTENT`, `SPII`) ou outros
 * códigos não-`STOP` (`OTHER`, `LANGUAGE`, etc.) são rejeitados explicitamente.
 */
export function assertAcceptableFinishReason(finishReason?: string): void {
  if (!finishReason || finishReason === 'STOP') {
    return;
  }

  if (finishReason === 'MAX_TOKENS') {
    throw new ProviderError(
      'incomplete_output',
      'Resposta truncada pelo limite de tokens (MAX_TOKENS)',
      'A resposta da IA foi interrompida por limite de tamanho e ficou incompleta.',
    );
  }

  if (FUNCTION_CALL_ERROR_FINISH_REASONS.has(finishReason)) {
    throw new ProviderError(
      'malformed_function_call',
      `Chamada de ferramenta inválida pelo modelo (${finishReason})`,
      'A IA gerou uma solicitação de ferramenta inválida.',
    );
  }

  if (BLOCKED_FINISH_REASONS.has(finishReason)) {
    throw new ProviderError(
      'blocked_output',
      `Resposta bloqueada pelo provedor (${finishReason})`,
      'A IA não pôde concluir a análise por restrição de segurança do provedor.',
    );
  }

  throw new ProviderError(
    'incomplete_output',
    `Resposta encerrada de forma incompleta (${finishReason})`,
    'A IA não concluiu a análise adequadamente.',
  );
}

/**
 * Valida o envelope retornado pelo Gemini, aplica a política de `finishReason`
 * (inclusive na etapa inicial de function calling) e garante presença de `content.parts`.
 */
export function extractPrimaryCandidate(raw: unknown): ValidatedGeminiCandidate {
  const parsed = geminiEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProviderError(
      'invalid_envelope',
      'Envelope da resposta do provedor inválido',
      'A IA não retornou uma análise válida.',
    );
  }

  const candidate = parsed.data.candidates[0];
  assertAcceptableFinishReason(candidate.finishReason);

  const parts = candidate.content?.parts;
  if (!parts || parts.length === 0) {
    throw new ProviderError(
      'invalid_envelope',
      'Conteúdo da resposta do provedor ausente',
      'A IA não retornou uma análise válida.',
    );
  }

  return {
    content: {
      role: candidate.content?.role,
      parts,
    },
    finishReason: candidate.finishReason,
  };
}

/**
 * Extrai o conteúdo JSON estruturado da resposta do Gemini ignorando partes internas
 * marcadas com `thought === true`, verificando finishReason e limite de tamanho.
 */
export function extractStructuredJson(raw: unknown): unknown {
  const candidate = extractPrimaryCandidate(raw);

  const visibleTexts = candidate.content.parts
    .filter((part) => part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text as string);

  if (visibleTexts.length !== 1) {
    throw new ProviderError(
      'invalid_envelope',
      'Resposta estruturada ausente',
      'A IA não retornou uma análise válida.',
    );
  }

  const text = visibleTexts[0];
  if (!text.trim() || text.length > MAX_OUTPUT_TEXT_CHARS) {
    throw new ProviderError(
      'incomplete_output',
      'Texto estruturado vazio ou acima do limite',
      'A IA não retornou uma análise válida.',
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError(
      'invalid_structured_json',
      'A IA retornou JSON inválido',
      'A IA retornou JSON inválido.',
    );
  }
}
