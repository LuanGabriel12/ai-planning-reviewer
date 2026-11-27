import type { Plan } from '../schemas/plan';

export interface ExamplePreset {
  id: string;
  label: string;
  description: string;
  plan: Plan;
}

export const EMPTY_PLAN: Plan = {
  disciplina: '',
  ano: '',
  objetivos: '',
  atividades: '',
  avaliacao: '',
};

export const DEFAULT_EXAMPLE_PLAN: Plan = {
  disciplina: 'Ciências da Natureza',
  ano: '6º ano do ensino fundamental',
  objetivos:
    'Identificar as etapas do ciclo da água e relacioná-las a situações cotidianas.',
  atividades:
    'Em grupos, observar um experimento simples de evaporação e representar o ciclo da água em um desenho.',
  avaliacao:
    'Analisar os desenhos e solicitar uma explicação individual sobre cada etapa do ciclo.',
};

export const EXAMPLE_PRESETS: ExamplePreset[] = [
  {
    id: 'ciencias-coerente',
    label: 'Ciências (6º ano)',
    description: 'Planejamento fictício com estrutura inicial coerente e lacunas de tempo/critérios.',
    plan: DEFAULT_EXAMPLE_PLAN,
  },
  {
    id: 'matematica-vaga',
    label: 'Matemática (objetivos vagos)',
    description: 'Planejamento fictício com objetivos genéricos e avaliação sem critérios.',
    plan: {
      disciplina: 'Matemática básica',
      ano: '7º ano do ensino fundamental',
      objetivos: 'Melhorar a matemática, aprender coisas novas e ficar pronto para o futuro.',
      atividades: 'O professor fala sobre números e os alunos fazem alguma atividade em grupo.',
      avaliacao: 'Observar a participação da turma sem critérios ou instrumentos especificados.',
    },
  },
  {
    id: 'matematica-desalinhada',
    label: 'Avaliação desalinhada',
    description: 'Planejamento fictício em que a avaliação não mede o objetivo de frações.',
    plan: {
      disciplina: 'Matemática',
      ano: '7º ano do ensino fundamental',
      objetivos: 'Interpretar e comparar frações em situações concretas do cotidiano.',
      atividades: 'A turma acompanha uma exposição oral sobre frações no quadro.',
      avaliacao: 'Escrever uma redação livre sobre a história do Brasil.',
    },
  },
];
