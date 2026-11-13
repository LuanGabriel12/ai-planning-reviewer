import {planSchema,reviewSchema,responseJsonSchema} from '../../src/schema';
import {buildPrompt,systemPrompt} from '../../src/prompt';
type Env={GEMINI_API_KEY?:string;LOCAL_DEV?:string;PRODUCTION_ENABLED?:string;CF_ACCESS_TEAM_DOMAIN?:string;CF_ACCESS_AUD?:string};
const fail=(message:string,status:number)=>Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
export async function onRequestPost({request,env}:{request:Request;env:Env}){
 const url=new URL(request.url);
 const local=env.LOCAL_DEV==='true'&&['localhost','127.0.0.1'].includes(url.hostname);
 // Hospedagem permanece bloqueada até proteção de custo e abuso estar implementada e verificada.
 if(!local)return fail('Endpoint hospedado bloqueado; controles de proteção pendentes.',503);
 if(request.headers.get('origin')!==url.origin)return fail('Origem inválida.',403);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return fail('Envie JSON.',415);
 if(!env.GEMINI_API_KEY)return fail('A chave Gemini não está configurada no servidor.',503);
 try{
  const reader=request.body?.getReader();if(!reader)return fail('Corpo ausente.',400);let size=0;const parts:Uint8Array[]=[];
  while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>12000){await reader.cancel();return fail('Conteúdo muito grande.',413);}parts.push(chunk.value)}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  let input:unknown;try{input=JSON.parse(new TextDecoder().decode(bytes))}catch{return fail('JSON inválido.',400)}
  const parsed=planSchema.safeParse(input);if(!parsed.success)return fail('Confira os campos e seus limites.',400);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
  try{
   const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:systemPrompt}]},contents:[{role:'user',parts:[{text:buildPrompt(parsed.data)}]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema,maxOutputTokens:2048,temperature:0.3}}),signal:controller.signal});
   if(!response.ok)return fail(response.status===429?'Limite do provedor atingido. Tente mais tarde.':response.status===400?'O provedor recusou a solicitação (400).':response.status===401||response.status===403?'O provedor recusou a chave ou o acesso (autenticação).':response.status===404?'O modelo configurado não está disponível para esta chave.':'Não foi possível consultar o provedor de IA.',502);
   const providerReader=response.body?.getReader(); if(!providerReader)return fail('A IA não retornou uma análise válida.',502); let providerSize=0; const providerParts:Uint8Array[]=[]; while(true){const chunk=await providerReader.read();if(chunk.done)break;providerSize+=chunk.value.byteLength;if(providerSize>64000){await providerReader.cancel();return fail('A resposta da IA excedeu o limite.',502)}providerParts.push(chunk.value)} const providerBytes=new Uint8Array(providerSize);let providerOffset=0;for(const part of providerParts){providerBytes.set(part,providerOffset);providerOffset+=part.length} let data:unknown;try{data=JSON.parse(new TextDecoder().decode(providerBytes))}catch{return fail('Resposta inválida do provedor.',502)} const text=(data as {candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>})?.candidates?.[0]?.content?.parts?.map(p=>p.text??'').join('');
   if(!text||text.length>20000)return fail('A IA não retornou uma análise válida.',502);
   let raw:unknown;try{raw=JSON.parse(text)}catch{return fail('A IA retornou JSON inválido.',502)}
   const result=reviewSchema.safeParse(raw);if(!result.success)return fail('A resposta da IA não passou na validação.',502);
   return Response.json(result.data,{headers:{'Cache-Control':'no-store'}});
  }finally{clearTimeout(timer)}
 }catch(e){return fail(e instanceof Error&&e.name==='AbortError'?'A consulta demorou demais.':'Não foi possível concluir a análise.',502)}
}
