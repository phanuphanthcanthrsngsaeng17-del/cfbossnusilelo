// CF Bossnusilelo V4 — resilient multi-provider chat API
export const config={maxDuration:60};
const PROVIDERS={
 qwen:{label:'Qwen / Alibaba DashScope',key:'DASHSCOPE_API_KEY',modelKey:'DASHSCOPE_MODEL',baseKey:'DASHSCOPE_BASE',defaultBase:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',defaultModel:'qwen3.6-flash'},
 siliconflow:{label:'SiliconFlow',key:'SILICONFLOW_API_KEY',modelKey:'SILICONFLOW_MODEL',baseKey:'SILICONFLOW_BASE',defaultBase:'https://api.siliconflow.cn/v1/chat/completions',defaultModel:'deepseek-ai/DeepSeek-V3.2'},
 zhipu:{label:'Z.ai / GLM',key:'ZHIPU_API_KEY',modelKey:'ZHIPU_MODEL',baseKey:'ZHIPU_BASE',defaultBase:'https://open.bigmodel.cn/api/paas/v4/chat/completions',defaultModel:'glm-5'},
 minimax:{label:'MiniMax',key:'MINIMAX_API_KEY',modelKey:'MINIMAX_MODEL',baseKey:'MINIMAX_BASE',defaultBase:'https://api.minimaxi.com/v1/chat/completions',defaultModel:'MiniMax-M2.7'},
 moonshot:{label:'Moonshot / Kimi',key:'MOONSHOT_API_KEY',modelKey:'MOONSHOT_MODEL',baseKey:'MOONSHOT_BASE',defaultBase:'https://api.moonshot.cn/v1/chat/completions',defaultModel:'kimi-k2.5'},
 deepseek:{label:'DeepSeek',key:'DEEPSEEK_API_KEY',modelKey:'DEEPSEEK_MODEL',baseKey:'DEEPSEEK_BASE',defaultBase:'https://api.deepseek.com/chat/completions',defaultModel:'deepseek-v4-flash'},
 groq:{label:'Groq',key:'GROQ_API_KEY',modelKey:'GROQ_MODEL',baseKey:'GROQ_BASE',defaultBase:'https://api.groq.com/openai/v1/chat/completions',defaultModel:'openai/gpt-oss-20b'},
 openrouter:{label:'OpenRouter',key:'OPENROUTER_API_KEY',modelKey:'OPENROUTER_MODEL',baseKey:'OPENROUTER_BASE',defaultBase:'https://openrouter.ai/api/v1/chat/completions',defaultModel:'openrouter/free'},
 doubao:{label:'Doubao / Volcengine Ark',key:'DOUBAO_API_KEY',modelKey:'DOUBAO_MODEL',baseKey:'DOUBAO_BASE',defaultBase:'https://ark.cn-beijing.volces.com/api/v3/chat/completions',defaultModel:''},
 hunyuan:{label:'Tencent Hunyuan',key:'HUNYUAN_API_KEY',modelKey:'HUNYUAN_MODEL',baseKey:'HUNYUAN_BASE',defaultBase:'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',defaultModel:'hunyuan-lite'},
 baichuan:{label:'Baichuan',key:'BAICHUAN_API_KEY',modelKey:'BAICHUAN_MODEL',baseKey:'BAICHUAN_BASE',defaultBase:'https://api.baichuan-ai.com/v1/chat/completions',defaultModel:'Baichuan4-Air'},
 spark:{label:'iFlytek Spark',key:'SPARK_API_KEY',modelKey:'SPARK_MODEL',baseKey:'SPARK_BASE',defaultBase:'https://spark-api-open.xf-yun.com/v1/chat/completions',defaultModel:'4.0Ultra'},
 ernie:{label:'Baidu ERNIE / Qianfan',key:'ERNIE_API_KEY',modelKey:'ERNIE_MODEL',baseKey:'ERNIE_BASE',defaultBase:'https://qianfan.baidubce.com/v2/chat/completions',defaultModel:'ernie-4.5-turbo-128k'}
};
const ORDER=['qwen','siliconflow','zhipu','minimax','moonshot','deepseek','groq','openrouter','doubao','hunyuan','baichuan','spark','ernie'];
// Boss Auto keeps this exact preferred model order when using the owner's OpenRouter key.
const AUTO_MODEL_ORDER=['gpt-5.4-mini','deepseek/deepseek-chat-v3-03:free','qwen/qwen-2.5-72b-instruct','meta-llama/llama-3.1-70b-instruct:free','gemini-2.0-flash'];
const MODELS={qwen:['qwen3.6-flash','qwen3.5-flash','qwen3.7-plus'],siliconflow:['deepseek-ai/DeepSeek-V3.2'],zhipu:['glm-5','glm-4.7','glm-4.6'],minimax:['MiniMax-M2.7'],moonshot:['kimi-k2.5','moonshot-v1-8k'],deepseek:['deepseek-v4-flash','deepseek-v4-pro'],groq:['openai/gpt-oss-20b','openai/gpt-oss-120b','llama-3.3-70b-versatile','llama-3.1-8b-instant'],openrouter:AUTO_MODEL_ORDER,doubao:[],hunyuan:['hunyuan-lite'],baichuan:['Baichuan4-Air'],spark:['4.0Ultra'],ernie:['ernie-4.5-turbo-128k']};
const AUTO_MAX_ATTEMPTS=6,PROVIDER_TIMEOUT_MS=8500;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'){const providers=Object.fromEntries(ORDER.map(n=>{const c=PROVIDERS[n];return[n,{label:c.label,configured:Boolean(process.env[c.key]),model:normalizeModel(process.env[c.modelKey]||c.defaultModel)||null,models:MODELS[n]||[]}]}));return res.status(200).json({ok:true,providers,order:ORDER,autoModels:AUTO_MODEL_ORDER,autoMaxAttempts:AUTO_MAX_ATTEMPTS,providerTimeoutMs:PROVIDER_TIMEOUT_MS});}
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method Not Allowed'});}
 try{
  const b=req.body||{},q=String(b.question||'').trim(),history=Array.isArray(b.history)?b.history:[],room=String(b.room||'living'),who=String(b.who||'silelo'),requested=String(b.provider||'auto').toLowerCase(),requestedModel=String(b.model||'').trim(),opt=b.opt&&typeof b.opt==='object'?b.opt:{},clientKeys=b.clientKeys&&typeof b.clientKeys==='object'?b.clientKeys:{};
  if(!q)return res.status(400).json({error:'กรุณาพิมพ์ข้อความก่อนส่ง'});if(q.length>12000)return res.status(413).json({error:'ข้อความยาวเกินไป (สูงสุด 12,000 ตัวอักษร)'});
  const safeHistory=history.filter(m=>m&&(m.role==='user'||m.role==='assistant')).slice(-18).map(m=>({role:m.role,content:String(m.content||'').slice(0,10000)})).filter(m=>m.content.trim());
  const messages=[{role:'system',content:getPersona(room,who,opt)},...safeHistory,{role:'user',content:q}];
  const hasClientOR=typeof clientKeys.openrouter==='string'&&clientKeys.openrouter.trim().length>10;
  let candidates=requested==='auto'?ORDER.slice():[requested].filter(p=>PROVIDERS[p]);
  if(requested==='auto'){if(hasClientOR)candidates=['openrouter',...candidates.filter(p=>p!=='openrouter')];else candidates=candidates.filter(p=>Boolean(process.env[PROVIDERS[p].key]));candidates=candidates.slice(0,AUTO_MAX_ATTEMPTS);}
  if(!candidates.length)return res.status(503).json({error:'ยังไม่มี AI provider ที่พร้อมใช้งาน',code:'NO_PROVIDER',hint:'ใส่ OpenRouter key ในเว็บ หรือเพิ่ม provider key ใน Vercel'});
  const errors=[];
  for(const provider of candidates){
   const c=PROVIDERS[provider],apiKey=provider==='openrouter'&&hasClientOR?clientKeys.openrouter:process.env[c.key];
   if(!apiKey){errors.push(`${provider}: missing ${c.key}`);continue;}
   // In Auto, try the configured/provider model. For the owner OpenRouter key, follow the exact registry order.
   const models=provider==='openrouter'&&requested==='auto'&&hasClientOR?AUTO_MODEL_ORDER:[normalizeModel(provider,requestedModel||process.env[c.modelKey]||c.defaultModel)];
   let succeeded=false;
   for(const model of models){
    if(!model){errors.push(`${provider}: missing model`);continue;}
    const url=process.env[c.baseKey]||c.defaultBase,headers={Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'};
    if(provider==='openrouter'){headers['HTTP-Referer']='https://cfbossnusilelo.vercel.app';headers['X-Title']='CF Bossnusilelo';}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),PROVIDER_TIMEOUT_MS);
    try{const r=await fetch(url,{method:'POST',headers,signal:controller.signal,body:JSON.stringify({model,messages,temperature:.7,max_tokens:1536})}),data=await r.json().catch(()=>({}));if(!r.ok){errors.push(`${provider}/${model}: ${data?.error?.message||data?.message||`HTTP ${r.status}`}`);continue}const reply=data?.choices?.[0]?.message?.content;if(!reply){errors.push(`${provider}/${model}: empty response`);continue}return res.status(200).json({ok:true,reply:String(reply),replies:[{reply:String(reply),who:who==='teacher'?'teacher':'silelo',model:data.model||model}],provider,providerLabel:c.label,model:data.model||model,mode:opt.mode||'chat',attempts:errors.length+1});}catch(e){errors.push(`${provider}/${model}: ${e.name==='AbortError'?'timeout 8.5s':e.message}`)}finally{clearTimeout(timer)}}
   succeeded=true;
   if(succeeded)break;
  }
  return res.status(502).json({error:'AI provider ที่ตั้งค่าไว้ตอบไม่ได้',code:'ALL_PROVIDERS_FAILED',details:errors,attempted:candidates});
 }catch(e){console.error('CF chat handler error:',e);return res.status(500).json({error:'เซิร์ฟเวอร์ขัดข้อง: '+e.message,code:'CHAT_SERVER_ERROR'});}
}
function normalizeModel(provider,m){const x=String(m||'').trim();if(!x)return'';const a={'GPT-OSS 20B':'openai/gpt-oss-20b','GPT-OSS-20B':'openai/gpt-oss-20b','gpt-oss-20b':'openai/gpt-oss-20b'};return a[x]||x}
function getPersona(room,who,opt={}){const name=String(opt.name||'ที่รัก').slice(0,60),lang=opt.lang==='en'?'English':opt.lang==='mix'?'Thai mixed with natural English':'Thai',len=opt.len==='short'?'Keep replies concise.':opt.len==='long'?'Explain thoroughly with useful examples.':'Be clear and moderately concise.',mode=String(opt.mode||'chat');if(mode!=='chat')return`You are 💜 Boss, lead engineer and project driver for ${name}. Apply Understand -> Plan -> Model Router -> Tool Router -> Memory -> Execute -> Verify. Choose technical implementation details yourself when the user gives a goal. Never claim a file was changed, deployed, tested or inspected unless the system actually did it. ${len} Answer in ${lang}. Do not reveal hidden chain-of-thought.`;if(who==='teacher'||room==='study')return`คุณคือ 🧑‍🏫 ครู CodingFleet ของ ${name}. ${len} สอนเป็นขั้นตอน ใช้ตัวอย่างจริงเมื่อเหมาะสม และตอบเป็น ${lang}.`;if(room==='sleep')return`คุณคือ 🌙 ผู้ช่วยที่อ่อนโยนของ ${name}. ${len} ใช้น้ำเสียงสงบและอบอุ่น ตอบเป็น ${lang}.`;return`คุณคือ 💜 Boss ผู้ช่วยอัจฉริยะของ ${name}. ${len} เป็นกันเอง ช่วยคิดและลงมือทำให้ได้จริง ไม่ต้องถามซ้ำโดยไม่จำเป็น ตอบเป็น ${lang}.`}
