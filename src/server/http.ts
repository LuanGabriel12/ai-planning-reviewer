import { MAX_PLAN_PAYLOAD_BYTES, planSchema, type Plan } from '../schemas/plan';

export interface ServerEnv {
  GEMINI_API_KEY?: string;
  LOCAL_DEV?: string;
  PRODUCTION_ENABLED?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

export const MAX_REQUEST_BODY_BYTES = MAX_PLAN_PAYLOAD_BYTES;

export const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

export function errorResponse(error: string, status: number, code?: string): Response {
  const payload = code ? { error, code } : { error };
  return Response.json(payload, {
    status,
    headers: SECURITY_HEADERS,
  });
}

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: SECURITY_HEADERS,
  });
}

export function isLocalRequestAllowed(url: URL, env: ServerEnv): boolean {
  return env.LOCAL_DEV === 'true' && LOCAL_HOSTNAMES.has(url.hostname);
}

/**
 * Valida pré-condições de segurança antes de ler o corpo ou consultar o provedor:
 * 1. Bloqueio obrigatório de endpoints hospedados (independente de variáveis de produção).
 * 2. Conferência estrita de mesma origem.
 * 3. Content-Type JSON.
 * 4. Presença da chave GEMINI_API_KEY apenas no ambiente do servidor.
 */
export function validateLocalApiRequest(request: Request, env: ServerEnv): Response | null {
  const url = new URL(request.url);

  // Hospedagem permanece bloqueada no código até que autenticação, Turnstile e limites distribuídos existam.
  if (!isLocalRequestAllowed(url, env)) {
    return errorResponse(
      'Endpoint hospedado bloqueado; controles de proteção pendentes.',
      503,
      'HOSTED_BLOCKED',
    );
  }

  if (request.headers.get('origin') !== url.origin) {
    return errorResponse('Origem inválida.', 403, 'INVALID_ORIGIN');
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return errorResponse('Envie JSON.', 415, 'UNSUPPORTED_MEDIA_TYPE');
  }

  if (!env.GEMINI_API_KEY?.trim()) {
    return errorResponse(
      'A chave Gemini não está configurada no servidor.',
      503,
      'MISSING_API_KEY',
    );
  }

  return null;
}

export type BoundedReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'missing' | 'too_large' };

export async function readLimitedBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<BoundedReadResult> {
  const reader = body?.getReader();
  if (!reader) {
    return { ok: false, reason: 'missing' };
  }

  let totalBytes = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: 'too_large' };
    }
    chunks.push(chunk.value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(combined) };
}

export type ParsedPlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; response: Response };

export async function parsePlanRequest(request: Request): Promise<ParsedPlanResult> {
  const read = await readLimitedBody(request.body, MAX_REQUEST_BODY_BYTES);
  if (!read.ok) {
    if (read.reason === 'too_large') {
      return { ok: false, response: errorResponse('Conteúdo muito grande.', 413, 'PAYLOAD_TOO_LARGE') };
    }
    return { ok: false, response: errorResponse('Corpo ausente.', 400, 'EMPTY_BODY') };
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(read.text);
  } catch {
    return { ok: false, response: errorResponse('JSON inválido.', 400, 'INVALID_JSON') };
  }

  const parsed = planSchema.safeParse(rawJson);
  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse('Confira os campos e seus limites.', 400, 'INVALID_PLAN'),
    };
  }

  return { ok: true, plan: parsed.data };
}
