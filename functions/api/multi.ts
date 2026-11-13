import {z} from 'zod';
import {planSchema} from '../../src/schema';
import {createGateway,orchestrate} from '../../src/server/agents/orchestrator';
type Env={LOCAL_DEV?:string;GEMINI_API_KEY?:string};
const fail=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function onRequestPost({request,env}:{request:Request;env:Env}){
 const url=new URL(request.url);if(env.LOCAL_DEV!=='true'||!['localhost','127.0.0.1'].includes(url.hostname))return fail('Endpoint hospedado bloqueado; controles de proteção pendentes.',503);
 if(request.headers.get('origin')!==url.origin)return fail('Origem inválida.',403);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return fail('Envie JSON.',415);
 if(!env.GEMINI_API_KEY)return fail('A chave Gemini não está configurada no servidor.',503);
 let payload:unknown;try{const reader=request.body?.getReader();if(!reader)return fail('Corpo ausente.',400);let size=0;const chunks:Uint8Array[]=[];while(true){const c=await reader.read();if(c.done)break;size+=c.value.length;if(size>12000){await reader.cancel();return fail('Conteúdo muito grande.',413)}chunks.push(c.value)}const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length}payload=JSON.parse(new TextDecoder().decode(bytes));}catch{return fail('JSON inválido.',400)}
 const parsed=planSchema.safeParse(payload);if(!parsed.success)return fail('Confira os campos e seus limites.',400);
 const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),75000);request.signal.addEventListener('abort',()=>abort.abort(),{once:true});const encoder=new TextEncoder();
 const stream=new ReadableStream({start(controller){const send=(event:unknown)=>{if(!abort.signal.aborted)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'))};void (async()=>{try{const output=await orchestrate(parsed.data,createGateway(env.GEMINI_API_KEY!,abort.signal),abort.signal,(stage)=>send({tipo:'etapa',etapa:stage}));send({tipo:'resultado',resultado:output});}catch(e){const tipo=e instanceof Error?(e instanceof z.ZodError?'estrutura inválida: '+e.issues.map(i=>i.code+' '+i.path.filter(x=>['pontosFortes','inconsistencias','sugestoes','fatosInformados','inferencias','candidates','content','parts','decisao','problemas','orientacao','id','name','args'].includes(String(x))).join('.')).join(', '):e.message.startsWith('Falha do provedor HTTP ')?e.message:'falha de processamento'):'falha desconhecida';console.warn('Multiagente:',tipo);send({tipo:'erro',mensagem:'Não foi possível concluir a análise multiagente. Tente novamente.'});}finally{clearTimeout(timeout);try{controller.close()}catch{ /* cliente desconectado */ }}})()},cancel(){clearTimeout(timeout);abort.abort()}});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store, no-transform','X-Content-Type-Options':'nosniff'}});
}
