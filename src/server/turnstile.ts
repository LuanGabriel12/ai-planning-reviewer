/** Preparação isolada para deploy futuro; não habilita o endpoint hospedado. */
export async function verifyTurnstile(token:string, secret:string, hostname:string):Promise<boolean>{
 if(!token || token.length>2048 || !secret || !hostname)return false;
 try {
  const body=new URLSearchParams({secret,response:token});
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body,signal:AbortSignal.timeout(5000)});
  if(!response.ok)return false;
  const result:unknown=await response.json();
  const value=result as {success?:unknown;hostname?:unknown};
  return value.success===true && value.hostname===hostname;
 } catch {return false}
}
