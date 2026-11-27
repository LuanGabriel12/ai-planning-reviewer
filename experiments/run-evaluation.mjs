import { readFile, writeFile } from 'node:fs/promises';
import { MAX_PLAN_PAYLOAD_BYTES, planSchema } from '../src/schemas/plan.ts';

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return undefined;
  return process.argv[index + 1];
}

const mode = getArgValue('--mode') ?? 'dry-run';
const casesPayload = JSON.parse(await readFile('experiments/cases.json', 'utf8'));
const rubricPayload = JSON.parse(await readFile('experiments/rubric.json', 'utf8'));

if (mode === 'dry-run') {
  const summary = casesPayload.cases.map((item) => {
    const check = planSchema.safeParse(item.plan);
    const bytes = new TextEncoder().encode(JSON.stringify(item.plan)).byteLength;
    return {
      id: item.id,
      category: item.category,
      validPlanSchema: check.success,
      payloadBytes: bytes,
      within12kbLimit: bytes <= MAX_PLAN_PAYLOAD_BYTES,
    };
  });

  const allValid = summary.every((row) => row.validPlanSchema && row.within12kbLimit);
  const report = {
    mode: 'dry-run',
    executedAt: new Date().toISOString(),
    realApiCalls: 0,
    totalCases: summary.length,
    rubricDimensions: rubricPayload.dimensions.length,
    maxRubricScore: rubricPayload.maxTotalScore,
    allValid,
    cases: summary,
  };

  await writeFile(
    'experiments/dry-run-validation.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );

  console.log(
    `Dry-run concluído: ${summary.length} casos verificados, ${rubricPayload.dimensions.length} dimensões na rubrica, 0 chamadas reais ao Gemini.`,
  );
  if (!allValid) {
    console.error('Um ou mais casos falharam na validação do schema.');
    process.exit(1);
  }
  process.exit(0);
}

if (mode === 'real') {
  const confirmed = process.argv.includes('--confirm-real-calls');
  const maxCallsRaw = getArgValue('--max-calls');
  const maxCalls = maxCallsRaw ? Number.parseInt(maxCallsRaw, 10) : 0;

  if (!confirmed || !Number.isInteger(maxCalls) || maxCalls <= 0) {
    console.error(
      'Execução real bloqueada por segurança. Informe explicitamente --confirm-real-calls --max-calls <N> após confirmar plano e cotas no Google AI Studio.',
    );
    process.exit(1);
  }

  console.error(
    'Para executar comparações reais entre /api/analyze e /api/multi, inicie o servidor local (`npm run preview:full`) com `.dev.vars` configurado e envie requisições controladas respeitando o teto autorizado.',
  );
  console.error(
    `Lote configurado: até ${maxCalls} chamadas. Nenhuma chamada foi disparada automaticamente por este script sem endpoint local ativo.`,
  );
  process.exit(1);
}

console.error(`Modo desconhecido: ${mode}. Use --mode dry-run ou --mode real.`);
process.exit(1);
