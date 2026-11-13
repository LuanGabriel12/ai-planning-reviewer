import {z} from 'zod';
const field=(max:number,min=10)=>z.string().trim().min(min).max(max);
export const planSchema=z.object({disciplina:field(120,2),ano:field(120,2),objetivos:field(1200),atividades:field(1800),avaliacao:field(1200)}).strict();
export const reviewSchema=z.object({pontosFortes:z.array(z.string().trim().min(1).max(700)).min(1).max(5),inconsistencias:z.array(z.string().trim().min(1).max(700)).min(1).max(5),sugestoes:z.array(z.string().trim().min(1).max(700)).min(1).max(5)}).strict();
export type Plan=z.infer<typeof planSchema>;
export const responseJsonSchema={type:'object',properties:{pontosFortes:{type:'array',items:{type:'string'}},inconsistencias:{type:'array',items:{type:'string'}},sugestoes:{type:'array',items:{type:'string'}}},required:['pontosFortes','inconsistencias','sugestoes']};
