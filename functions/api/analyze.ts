import { buildPrompt, systemPrompt } from '../../src/prompts/single';
import { responseJsonSchema, reviewSchema } from '../../src/schemas/plan';
import {
  ProviderError,
  SINGLE_CALL_TIMEOUT_MS,
  callGemini,
  extractStructuredJson,
} from '../../src/server/gemini/client';
import {
  errorResponse,
  jsonResponse,
  parsePlanRequest,
  validateLocalApiRequest,
  type ServerEnv,
} from '../../src/server/http';

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

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SINGLE_CALL_TIMEOUT_MS);

  const onClientAbort = () => controller.abort();
  request.signal.addEventListener('abort', onClientAbort, { once: true });

  try {
    const rawProviderResponse = await callGemini({
      apiKey: env.GEMINI_API_KEY!,
      signal: controller.signal,
      body: {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: buildPrompt(parsedRequest.plan) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema,
          maxOutputTokens: 2048,
          temperature: 0.3,
        },
      },
    });

    const structuredJson = extractStructuredJson(rawProviderResponse);
    const validated = reviewSchema.safeParse(structuredJson);
    if (!validated.success) {
      return errorResponse('A resposta da IA não passou na validação.', 502, 'VALIDATION_FAILED');
    }

    return jsonResponse(validated.data);
  } catch (error) {
    if (error instanceof ProviderError) {
      return errorResponse(error.userMessage, 502, error.kind.toUpperCase());
    }
    if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
      if (request.signal.aborted && !timedOut) {
        return errorResponse('Análise cancelada pelo cliente.', 499, 'CLIENT_ABORTED');
      }
      return errorResponse('A consulta demorou demais.', 502, 'TIMEOUT');
    }
    return errorResponse('Não foi possível concluir a análise.', 502, 'UPSTREAM_FAILURE');
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', onClientAbort);
  }
}
