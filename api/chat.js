// CF Bossnusilelo V5 — resilient chat API with Vercel body parsing fix
export const config={maxDuration:60};
const PROVIDERS={
 qwen:{label:'Qwen / DashScope',key:'DASHSCOPE_API_KEY',base:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',model:'qwen3.6-flash'},
 siliconflow:{label:'SiliconFlow',key:'SILICONFLOW_API_KEY',base:'https://api.siliconflow.cn/v1/chat/completions',model:'deepseek-ai/DeepSeek-V3.2'},
 zhipu:{label:'Z.ai / GLM',key:'ZHIPU_API_KEY',base:'https://open.bigmodel.cn/api/paas/v4/chat/completions',model:'glm-5'},
 minimax:{label:'MiniMax',key:'MINIMAX_API_KEY',base:'https://api.minimaxi.com/v1/chat/completions',model:'MiniMax-M2.7'},
 moonshot:{label:'Moonshot / Kimi',key:'MOONSHOT_API_KEY',base:'https://api.moonshot.cn/v1/chat/completions',model:'kimi-k2.5'},
 deepseek:{label:'DeepSeek',key:'DEEPSEEK_API_KEY',base:'https://api.deepseek.com/chat/completions',model:'deepseek-v4-flash'},
 groq:{label:'Groq (ฟรี)',key:'GROQ_API_KEY',base:'https://api.groq.com/openai/v1/chat/completions',model:'openai/gpt-oss-20b'},
 openrouter:{label:'OpenRouter (ฟรี)',key:'OPENROUTER_API_KEY',base:'https://openrouter.ai/api/v1/chat/completions',model:'openrouter/free'}
};
const ORDER=['qwen','siliconflow','zhipu','minimax','moonshot','deepseek','groq','openrouter'];
const AUTO_MODEL_ORDER=['openrouter/free','nvidia/nemotron-3-ultra-550b-a55b:free','google/gemma-4-26b-a4b-it:free'];
const TIMEOUT=6500,MAX_ATTEMPTS=3;
async function readBody(req){try{if(req.body&&typeof req.body==='object'&&Object.keys(req.body).length)return req.body;const chunks=[];for await(const c of req)chunks.push(c);const raw=Buffer.concat(chunks).toString('utf8');return raw?JSON.parse(raw):{};}catch{return{};}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'){const providers=Object.fromEntries(ORDER.map(n=>{const p=PROVIDERS[n];return[n,{label:p.label,configured:Boolean(process.env[p.key]),model:process.env[p.key]?process.env[`${n.toUpperCase()}_MODEL`]||p.model:null,models:n==='openrouter'?AUTO_MODEL_ORDER:[p.model]}]}));return res.status(200).json({ok:true,providers,order:ORDER,autoModels:AUTO_MODEL_ORDER,autoMaxAttempts:MAX_ATTEMPTS,providerTimeoutMs:TIMEOUT});}
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method Not Allowed'});}
 try{
  const b=await readBody(req),q=String(b.question||'').trim();
  if(!q)return res.status(400).json({error:'กรุณาพิมพ์ข้อความก่อนส่ง'});
  if(q.length>12000)return res.status(413).json({error:'ข้อความยาวเกินไป (สูงสุด 12,000 ตัวอักษร)'});
  const history=Array.isArray(b.history)?b.history.filter(m=>m&&(m.role==='user'||m.role==='assistant')).slice(-18).map(m=>({role:m.role,content:String(m.content||'').slice(0,10000)})).filter(m=>m.content.trim()):[];
  const room=String(b.room||'living'),who=String(b.who||'silelo'),opt=b.opt&&typeof b.opt==='object'?b.opt:{},clientKeys=b.clientKeys&&typeof b.clientKeys==='object'?b.clientKeys:{};
  const messages=[{role:'system',content:getPersona(room,who,opt)},...history,{role:'user',content:q}];
  const requested=String(b.provider||'auto').toLowerCase(),requestedModel=String(b.model||'').trim();
  const hasClientOR=typeof clientKeys.openrouter==='string'&&clientKeys.openrouter.trim().length>10;
  let candidates=requested==='auto'?ORDER.slice():[requested].filter(Boolean);
  if(requested==='auto')candidates=(hasClientOR?['openrouter',...ORDER.filter(x=>x!=='openrouter'&&process.env[PROVIDERS[x]?.key])]:ORDER.filter(x=>process.env[PROVIDERS[x]?.key])).slice(0,MAX_ATTEMPTS);
  if(!candidates.length)return res.status(503).json({error:'ยังไม่มี AI provider ที่พร้อมใช้งาน',code:'NO_PROVIDER'});
  const errors=[];
  for(const name of candidates){const p=PROVIDERS[name];if(!p)continue;const key=name==='openrouter'&&hasClientOR?clientKeys.openrouter:process.env[p.key];if(!key){errors.push(`${name}: missing key`);continue;}
   const models=name==='openrouter'&&requested==='auto'&&hasClientOR?AUTO_MODEL_ORDER:[requestedModel||process.env[`${name.toUpperCase()}_MODEL`]||p.model];
   for(const model of models){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT);try{const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};if(name==='openrouter'){headers['HTTP-Referer']='https://cfbossnusilelo.vercel.app';headers['X-Title']='CF Bossnusilelo';}const r=await fetch(p.base,{method:'POST',headers,signal:controller.signal,body:JSON.stringify({model,messages,temperature:.7,max_tokens:1536})});const data=await r.json().catch(()=>({}));if(!r.ok){errors.push(`${name}/${model}: ${data?.error?.message||data?.message||`HTTP ${r.status}`}`);continue;}const reply=data?.choices?.[0]?.message?.content;if(!reply){errors.push(`${name}/${model}: empty response`);continue;}return res.status(200).json({ok:true,reply:String(reply),provider:name,providerLabel:p.label,model:data.model||model,attempts:errors.length+1});}catch(e){errors.push(`${name}/${model}: ${e.name==='AbortError'?'timeout':e.message}`)}finally{clearTimeout(timer)}}
  }
  return res.status(502).json({error:'AI provider ทั้งหมดตอบไม่ได้',code:'ALL_PROVIDERS_FAILED',details:errors,attempted:candidates});
 }catch(e){console.error('CF chat handler error:',e);return res.status(500).json({error:'เซิร์ฟเวอร์ขัดข้อง: '+e.message,code:'CHAT_SERVER_ERROR'});}
}
function getPersona(room,who,opt={}){const lang=opt.lang==='en'?'English':opt.lang==='mix'?'Thai mixed with natural English':'Thai';const len=opt.len==='short'?'Keep replies concise.':opt.len==='long'?'Explain thoroughly with useful examples.':'Be clear and moderately concise.';if(who==='teacher'||room==='study')return`คุณคือ 🧑‍🏫 ครู CodingFleet. ${len} ตอบเป็น ${lang}.`;if(room==='sleep')return`คุณคือ 🌙 ผู้ช่วยที่อ่อนโยน. ${len} ตอบเป็น ${lang}.`;return`คุณคือ 💜 Boss ผู้ช่วยอัจฉริยะ. ${len} ช่วยคิดและลงมือทำให้ได้จริง ไม่ถามซ้ำโดยไม่จำเป็น ตอบเป็น ${lang}.`;}
