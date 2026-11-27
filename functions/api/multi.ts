import { z } from 'zod';
import { createGateway, orchestrate } from '../../src/server/agents/orchestrator';
import { MULTI_TOTAL_TIMEOUT_MS, ProviderError } from '../../src/server/gemini/client';
import {
  errorResponse,
  parsePlanRequest,
  validateLocalApiRequest,
  type ServerEnv,
} from '../../src/server/http';

const SAFE_LOG_KEYS = new Set([
  'pontosFortes',
  'inconsistencias',
  'sugestoes',
  'fatosInformados',
  'inferencias',
  'candidates',
  'content',
  'parts',
  'decisao',
  'problemas',
  'orientacao',
  'id',
  'name',
  'args',
  'tema',
]);

function summarizeSafeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issues = error.issues
      .map((issue) => {
        const safePath = issue.path.filter((segment) => SAFE_LOG_KEYS.has(String(segment))).join('.');
        return `${issue.code}${safePath ? ` ${safePath}` : ''}`;
      })
      .join(', ');
    return `estrutura inválida: ${issues}`;
  }
  if (error instanceof ProviderError) {
    return error.message;
  }
  if (error instanceof Error && error.message.startsWith('Falha do provedor HTTP ')) {
    return error.message;
  }
  return 'falha de processamento';
}

export async function onRequestPost({
  request,
  env,
}: {
  request: Request;
  env: ServerEnv;
}): Promise<Response> {
  const guardFailure = validateLocalApiRequest(request, env);
  if (guardFailure) {
    return guardFailure;
  }

  if (request.signal.aborted) {
    return errorResponse('Análise cancelada pelo cliente.', 499, 'CLIENT_ABORTED');
  }

  const parsedRequest = await parsePlanRequest(request);
  if (!parsedRequest.ok) {
    return parsedRequest.response;
  }

  if (request.signal.aborted) {
    return errorResponse('Análise cancelada pelo cliente.', 499, 'CLIENT_ABORTED');
  }

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), MULTI_TOTAL_TIMEOUT_MS);
  const onClientAbort = () => abort.abort();
  if (request.signal.aborted) {
    abort.abort();
  } else {
    request.signal.addEventListener('abort', onClientAbort, { once: true });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: unknown) => {
        if (!abort.signal.aborted) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      };

      void (async () => {
        try {
          const gateway = createGateway(env.GEMINI_API_KEY!, abort.signal);
          const output = await orchestrate(parsedRequest.plan, gateway, abort.signal, (stage) => {
            send({ tipo: 'etapa', etapa: stage });
          });
          send({ tipo: 'resultado', resultado: output });
        } catch (error) {
          console.warn('Multiagente:', summarizeSafeError(error));
          send({
            tipo: 'erro',
            mensagem: 'Não foi possível concluir a análise multiagente. Tente novamente.',
          });
        } finally {
          clearTimeout(timeout);
          request.signal.removeEventListener('abort', onClientAbort);
          try {
            controller.close();
          } catch {
            // Cliente desconectado antes do encerramento do stream.
          }
        }
      })();
    },
    cancel() {
      clearTimeout(timeout);
      request.signal.removeEventListener('abort', onClientAbort);
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
