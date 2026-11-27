// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/main';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('interface V2 — estados, acessibilidade e resiliência', () => {
  it('exibe resultado estruturado, permite editar, restaurar e limpar formulário', async () => {
    const review = {
      pontosFortes: ['Atividade prática conectada ao objetivo.'],
      inconsistencias: ['Não informa a duração da aula.'],
      sugestoes: ['Estimar o tempo para cada etapa.'],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => review,
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Usar exemplo fictício/ }));
    fireEvent.click(screen.getByRole('button', { name: /Analisar com IA/ }));

    const textarea = (await screen.findByLabelText('Análise editável')) as HTMLTextAreaElement;
    expect(screen.getByText('Modo: Agente único')).toBeTruthy();
    expect(screen.getAllByText('Chamadas ao modelo: 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Atividade prática conectada ao objetivo.')).toBeTruthy();

    const originalValue = textarea.value;
    fireEvent.change(textarea, { target: { value: 'Texto adaptado pela educadora' } });
    expect(screen.getByText('Editado localmente')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Restaurar texto gerado/ }));
    expect(textarea.value).toBe(originalValue);

    fireEvent.click(screen.getByRole('button', { name: /Limpar campos/ }));
    expect((screen.getByPlaceholderText(/Ciências da Natureza/) as HTMLInputElement).value).toBe(
      '',
    );
  });

  it('permite escolher presets adicionais e trata resposta HTTP não-JSON sem quebrar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Avaliação desalinhada/ }));
    fireEvent.click(screen.getByRole('button', { name: /Analisar com IA/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Não foi possível analisar.');
  });

  it('mostra carregamento honesto e permite cancelar no modo agente único', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url, options: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('abortado')));
          }),
      ),
    );

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Usar exemplo fictício/ }));
    fireEvent.click(screen.getByRole('button', { name: /Analisar com IA/ }));

    expect(screen.getByRole('status').textContent).toContain('chamada única');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Análise cancelada.');
  });

  it('lê stream NDJSON mesmo sem quebra de linha final e exibe ferramenta consultada', async () => {
    const result = {
      analise: {
        pontosFortes: ['Objetivo claro'],
        inconsistencias: ['Critérios ausentes'],
        sugestoes: ['Criar rubrica'],
        fatosInformados: ['Experimento de evaporação'],
        inferencias: ['Tempo não especificado'],
      },
      ressalvas: ['Verifique os critérios de avaliação'],
      estado: 'consolidado',
      etapas: [
        'Analista: consulta de critério',
        'Ferramenta local: critério fictício consultado (avaliacao)',
        'Analista: análise estruturada',
        'Revisor: conferência crítica',
        'Orquestrador: resultado consolidado',
      ],
      chamadas: 3,
      ferramenta: true,
      ferramentaDetalhes: {
        nome: 'consultar_criterio_ficticio',
        tema: 'avaliacao',
        natureza: 'exemplo fictício, não é norma',
      },
    };

    const payloadWithoutTrailingNewline = [
      JSON.stringify({ tipo: 'etapa', etapa: 'Analista: consulta de critério' }),
      JSON.stringify({ tipo: 'resultado', resultado: result }),
    ].join('\n');

    const bytes = new TextEncoder().encode(payloadWithoutTrailingNewline);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => {
            let sent = false;
            return {
              read: async () => (sent ? { done: true } : { done: (sent = true) && false, value: bytes }),
            };
          },
        },
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Usar exemplo fictício/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /multiagente/ }));
    fireEvent.click(screen.getByRole('button', { name: /Analisar com IA/ }));

    await waitFor(() => {
      expect(screen.getByText(/consultar_criterio_ficticio \(avaliacao — fictício\)/)).toBeTruthy();
    });
    expect(screen.getByText('Modo: Multiagente')).toBeTruthy();
    expect(screen.getByText('Experimento de evaporação')).toBeTruthy();
  });
});
