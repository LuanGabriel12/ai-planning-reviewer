import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as analyzePost } from '../functions/api/analyze';
import { onRequestPost as multiPost } from '../functions/api/multi';
import {
  GEMINI_ENDPOINT,
  GEMINI_MODEL,
  ProviderError,
  assertAcceptableFinishReason,
  callGemini,
  extractPrimaryCandidate,
  extractStructuredJson,
} from '../src/server/gemini/client';

const plan = {
  disciplina: 'Ciências da Natureza',
  ano: '6º ano do ensino fundamental',
  objetivos: 'Identificar evaporação e condensação no ciclo da água.',
  atividades: 'Observar experimento simples de evaporação em grupos.',
  avaliacao: 'Explicar individualmente cada etapa observada no experimento.',
};

const env = { LOCAL_DEV: 'true', GEMINI_API_KEY: 'chave-secreta-de-teste-123' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cliente Gemini — confiabilidade e segurança', () => {
  it('preserva o modelo configurado e envia chave apenas no cabeçalho x-goog-api-key', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }],
      }),
    );

    await callGemini({
      apiKey: 'segredo-local',
      body: { contents: [] },
      signal: new AbortController().signal,
      fetcher,
    });

    expect(GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(GEMINI_ENDPOINT);
    expect(calledUrl).not.toContain('segredo-local');
    expect((calledInit.headers as Record<string, string>)['x-goog-api-key']).toBe('segredo-local');
  });

  it('mapeia erros HTTP 400, 401, 403, 404, 429 e 500 sem expor corpo bruto nem credenciais', async () => {
    for (const status of [400, 401, 403, 404, 429, 500]) {
      const fetcher = vi
        .fn()
        .mockResolvedValue(new Response('detalhe-secreto-do-provedor', { status }));

      await expect(
        callGemini({
          apiKey: 'segredo-local',
          body: {},
          signal: new AbortController().signal,
          fetcher,
        }),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(ProviderError);
        const providerErr = error as ProviderError;
        expect(providerErr.userMessage).not.toContain('detalhe-secreto-do-provedor');
        expect(providerErr.userMessage).not.toContain('segredo-local');
        expect(providerErr.message).not.toContain('detalhe-secreto-do-provedor');
        return true;
      });
    }
  });

  it('ignora partes internas marcadas com thought=true ao extrair JSON estruturado', () => {
    const raw = {
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [
              { thought: true, text: 'Raciocínio interno que nunca deve ir para o JSON' },
              {
                text: JSON.stringify({
                  pontosFortes: ['Objetivo claro'],
                  inconsistencias: ['Falta duração'],
                  sugestoes: ['Definir duração'],
                }),
              },
            ],
          },
        },
      ],
    };

    const extracted = extractStructuredJson(raw) as { pontosFortes: string[] };
    expect(extracted.pontosFortes).toEqual(['Objetivo claro']);
  });

  it('aplica política fail-closed de finishReason (MAX_TOKENS, MALFORMED_FUNCTION_CALL, SAFETY, SPII, OTHER)', () => {
    expect(() => assertAcceptableFinishReason(undefined)).not.toThrow();
    expect(() => assertAcceptableFinishReason('STOP')).not.toThrow();

    for (const truncated of ['MAX_TOKENS', 'OTHER', 'LANGUAGE']) {
      expect(() =>
        extractPrimaryCandidate({
          candidates: [{ finishReason: truncated }],
        }),
      ).toThrow(ProviderError);
      try {
        extractPrimaryCandidate({ candidates: [{ finishReason: truncated }] });
      } catch (error) {
        expect((error as ProviderError).kind).toBe('incomplete_output');
      }
    }

    for (const malformedTool of [
      'MALFORMED_FUNCTION_CALL',
      'UNEXPECTED_TOOL_CALL',
      'TOO_MANY_TOOL_CALLS',
    ]) {
      try {
        extractPrimaryCandidate({ candidates: [{ finishReason: malformedTool }] });
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).kind).toBe('malformed_function_call');
      }
    }

    for (const blocked of ['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']) {
      try {
        extractPrimaryCandidate({
          candidates: [{ finishReason: blocked, content: { parts: [{ text: '{}' }] } }],
        });
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).kind).toBe('blocked_output');
      }
    }

    expect(() =>
      extractStructuredJson({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: 'a'.repeat(20_001) }] } },
        ],
      }),
    ).toThrow(ProviderError);

    expect(() =>
      extractStructuredJson({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{invalido' }] } }],
      }),
    ).toThrow(ProviderError);
  });
});

describe('hardening HTTP das Pages Functions', () => {
  it('inclui cabeçalhos de segurança e rejeita Content-Type inválido e JSON malformado', async () => {
    const badType = await analyzePost({
      request: new Request('http://localhost:8788/api/analyze', {
        method: 'POST',
        headers: { origin: 'http://localhost:8788', 'content-type': 'text/plain' },
        body: JSON.stringify(plan),
      }),
      env,
    });
    expect(badType.status).toBe(415);
    expect(badType.headers.get('cache-control')).toBe('no-store');
    expect(badType.headers.get('x-content-type-options')).toBe('nosniff');

    const badJson = await multiPost({
      request: new Request('http://localhost:8788/api/multi', {
        method: 'POST',
        headers: { origin: 'http://localhost:8788', 'content-type': 'application/json' },
        body: '{nao-json',
      }),
      env,
    });
    expect(badJson.status).toBe(400);
    expect(badJson.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('interrompe antes de chamar Gemini quando request.signal já chega cancelado em /api/analyze e /api/multi', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const abortedSingle = new AbortController();
    abortedSingle.abort();
    const singleReq = new Request('http://localhost:8788/api/analyze', {
      method: 'POST',
      headers: { origin: 'http://localhost:8788', 'content-type': 'application/json' },
      body: JSON.stringify(plan),
      signal: abortedSingle.signal,
    });
    const singleRes = await analyzePost({ request: singleReq, env });
    expect(singleRes.status).toBe(499);
    expect(fetchMock).not.toHaveBeenCalled();

    const abortedMulti = new AbortController();
    abortedMulti.abort();
    const multiReq = new Request('http://localhost:8788/api/multi', {
      method: 'POST',
      headers: { origin: 'http://localhost:8788', 'content-type': 'application/json' },
      body: JSON.stringify(plan),
      signal: abortedMulti.signal,
    });
    const multiRes = await multiPost({ request: multiReq, env });
    expect(multiRes.status).toBe(499);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejeita resposta truncada com finishReason MAX_TOKENS em /api/analyze', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              finishReason: 'MAX_TOKENS',
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      pontosFortes: ['Parcial'],
                      inconsistencias: ['Cortado'],
                      sugestoes: ['Incompleto'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      ),
    );

    const response = await analyzePost({
      request: new Request('http://localhost:8788/api/analyze', {
        method: 'POST',
        headers: { origin: 'http://localhost:8788', 'content-type': 'application/json' },
        body: JSON.stringify(plan),
      }),
      env,
    });

    expect(response.status).toBe(502);
    expect(await response.text()).toContain('incompleta');
  });

  it('propaga cancelamento do cliente (request.signal) na rota /api/analyze', async () => {
    const clientAbort = new AbortController();
    const fetchMock = vi.fn().mockImplementation(
      (_url, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('http://localhost:8788/api/analyze', {
      method: 'POST',
      headers: { origin: 'http://localhost:8788', 'content-type': 'application/json' },
      body: JSON.stringify(plan),
      signal: clientAbort.signal,
    });

    const pending = analyzePost({ request, env });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    clientAbort.abort();
    const response = await pending;
    expect(response.status).toBe(499);
    const text = await response.text();
    expect(text).not.toContain(env.GEMINI_API_KEY);
  });

  it('nunca expõe GEMINI_API_KEY quando o provedor falha no modo agente único ou multiagente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error(`Falha com chave ${env.GEMINI_API_KEY}`)),
    );

    const singleRes = await analyzePost({
      request: new Request('http://localhost:8788/api/analyze', {
        method: 'POST',
        headers: { origin: 'http://localhost:8788', 'content-type': 'application/json' },
        body: JSON.stringify(plan),
      }),
      env,
    });
    expect(singleRes.status).toBe(502);
    expect(await singleRes.text()).not.toContain(env.GEMINI_API_KEY);

    const multiRes = await multiPost({
      request: new Request('http://localhost:8788/api/multi', {
        method: 'POST',
        headers: { origin: 'http://localhost:8788', 'content-type': 'application/json' },
        body: JSON.stringify(plan),
      }),
      env,
    });
    expect(await multiRes.text()).not.toContain(env.GEMINI_API_KEY);
  });
});
