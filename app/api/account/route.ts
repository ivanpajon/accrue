import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import { mutateAccount, readAccount } from '@/db/repository';
import { AccountError, mutationSchema } from '@/lib/account';

export const dynamic = 'force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
function failure(error:unknown) {
  if(error instanceof AccountError) return json({error:error.code},error.code==='missing'?404:409);
  console.error('Account database request failed',error);
  return json({error:'storageError'},503);
}
export async function GET() {
  const user=await getChatGPTUser();
  if(!user) return json({error:'unauthorized'},401);
  try { return json(await readAccount(getDb(),user.userId)); } catch(error) {return failure(error);}
}
export async function POST(request:Request) {
  const user=await getChatGPTUser();
  if(!user) return json({error:'unauthorized'},401);
  if(request.headers.get('Origin')!==new URL(request.url).origin || request.headers.get('Sec-Fetch-Site')==='cross-site') return json({error:'forbidden'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'invalidConfiguration'},415);
  let body:unknown;
  try {
    const reader=request.body?.getReader(); if(!reader) return json({error:'invalidConfiguration'},400);
    const chunks:Uint8Array[]=[];let size=0;
    while(true) {const {done,value}=await reader.read();if(done) break;size+=value.byteLength;if(size>65536){await reader.cancel();return json({error:'invalidConfiguration'},413);}chunks.push(value);}
    const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
    body=JSON.parse(new TextDecoder().decode(buffer));
  } catch {return json({error:'invalidConfiguration'},400);}
  const parsed=mutationSchema.safeParse(body);
  if(!parsed.success) return json({error:'invalidConfiguration'},400);
  try {const db=getDb();const saved=await mutateAccount(db,user.userId,parsed.data);return json({...await readAccount(db,user.userId),...(saved?{saved}:{})});}catch(error){return failure(error);}
}
