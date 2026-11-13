import {z} from 'zod';
import {reviewSchema} from './schema';
export const analystSchema=reviewSchema.extend({fatosInformados:z.array(z.string().min(1).max(400)).max(4),inferencias:z.array(z.string().min(1).max(400)).max(4)}).strict();
export const criticSchema=z.object({decisao:z.enum(['CONSOLIDAR','REVISAR','RESSALVAS']),problemas:z.array(z.string().min(1).max(500)).max(4),orientacao:z.string().max(800)}).strict();
export const multiResultSchema=z.object({analise:analystSchema,ressalvas:z.array(z.string().min(1).max(500)).max(8),estado:z.enum(['consolidado','revisado_sem_reavaliacao','com_ressalvas']),etapas:z.array(z.string().max(100)).max(12),chamadas:z.number().int().min(1).max(4),ferramenta:z.boolean()}).strict();
export type MultiResult=z.infer<typeof multiResultSchema>;
export type Analyst=z.infer<typeof analystSchema>;
export const analystJSON={type:'object',properties:{pontosFortes:{type:'array',minItems:1,maxItems:5,items:{type:'string',minLength:1,maxLength:700}},inconsistencias:{type:'array',minItems:1,maxItems:5,items:{type:'string',minLength:1,maxLength:700}},sugestoes:{type:'array',minItems:1,maxItems:5,items:{type:'string',minLength:1,maxLength:700}},fatosInformados:{type:'array',maxItems:4,items:{type:'string',minLength:1,maxLength:400}},inferencias:{type:'array',maxItems:4,items:{type:'string',minLength:1,maxLength:400}}},required:['pontosFortes','inconsistencias','sugestoes','fatosInformados','inferencias']};
export const criticJSON={type:'object',properties:{decisao:{type:'string',enum:['CONSOLIDAR','REVISAR','RESSALVAS']},problemas:{type:'array',maxItems:4,items:{type:'string',minLength:1,maxLength:500}},orientacao:{type:'string',maxLength:800}},required:['decisao','problemas','orientacao']};
