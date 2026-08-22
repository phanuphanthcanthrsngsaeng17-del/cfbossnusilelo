// CF Bossnusilelo V3 — resilient multi-provider chat API
// Keys stay server-side. Auto skips missing/failed providers and keeps latency bounded.
export const config = { maxDuration: 60 };

const PROVIDERS = {
  qwen: { label:'Qwen / Alibaba DashScope', key:'DASHSCOPE_API_KEY', modelKey:'DASHSCOPE_MODEL', baseKey:'DASHSCOPE_BASE', defaultBase:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', defaultModel:'qwen3.6-flash' },
  siliconflow: { label:'SiliconFlow', key:'SILICONFLOW_API_KEY', modelKey:'SILICONFLOW_MODEL', baseKey:'SILICONFLOW_BASE', defaultBase:'https://api.siliconflow.cn/v1/chat/completions', defaultModel:'deepseek-ai/DeepSeek-V3.2' },
  zhipu: { label:'Z.ai / GLM', key:'ZHIPU_API_KEY', modelKey:'ZHIPU_MODEL', baseKey:'ZHIPU_BASE', defaultBase:'https://open.bigmodel.cn/api/paas/v4/chat/completions', defaultModel:'glm-5' },
  minimax: { label:'MiniMax', key:'MINIMAX_API_KEY', modelKey:'MINIMAX_MODEL', baseKey:'MINIMAX_BASE', defaultBase:'https://api.minimaxi.com/v1/chat/completions', defaultModel:'MiniMax-M2.7' },
  moonshot: { label:'Moonshot / Kimi', key:'MOONSHOT_API_KEY', modelKey:'MOONSHOT_MODEL', baseKey:'MOONSHOT_BASE', defaultBase:'https://api.moonshot.cn/v1/chat/completions', defaultModel:'kimi-k2.5' },
  deepseek: { label:'DeepSeek', key:'DEEPSEEK_API_KEY', modelKey:'DEEPSEEK_MODEL', baseKey:'DEEPSEEK_BASE', defaultBase:'https://api.deepseek.com/chat/completions', defaultModel:'deepseek-v4-flash' },
  groq: { label:'Groq', key:'GROQ_API_KEY', modelKey:'GROQ_MODEL', baseKey:'GROQ_BASE', defaultBase:'https://api.groq.com/openai/v1/chat/completions', defaultModel:'openai/gpt-oss-20b' },
  openrouter: { label:'OpenRouter', key:'OPENROUTER_API_KEY', modelKey:'OPENROUTER_MODEL', baseKey:'OPENROUTER_BASE', defaultBase:'https://openrouter.ai/api/v1/chat/completions', defaultModel:'openrouter/free' },
  doubao: { label:'Doubao / Volcengine Ark', key:'DOUBAO_API_KEY', modelKey:'DOUBAO_MODEL', baseKey:'DOUBAO_BASE', defaultBase:'https://ark.cn-beijing.volces.com/api/v3/chat/completions', defaultModel:'' },
  hunyuan: { label:'Tencent Hunyuan', key:'HUNYUAN_API_KEY', modelKey:'HUNYUAN_MODEL', baseKey:'HUNYUAN_BASE', defaultBase:'https://api.hunyuan.cloud.tencent.com/v1/chat/completions', defaultModel:'hunyuan-lite' },
  baichuan: { label:'Baichuan', key:'BAICHUAN_API_KEY', modelKey:'BAICHUAN_MODEL', baseKey:'BAICHUAN_BASE', defaultBase:'https://api.baichuan-ai.com/v1/chat/completions', defaultModel:'Baichuan4-Air' },
  spark: { label:'iFlytek Spark', key:'SPARK_API_KEY', modelKey:'SPARK_MODEL', baseKey:'SPARK_BASE', defaultBase:'https://spark-api-open.xf-yun.com/v1/chat/completions', defaultModel:'4.0Ultra' },
  ernie: { label:'Baidu ERNIE / Qianfan', key:'ERNIE_API_KEY', modelKey:'ERNIE_MODEL', baseKey:'ERNIE_BASE', defaultBase:'https://qianfan.baidubce.com/v2/chat/completions', defaultModel:'ernie-4.5-turbo-128k' }
};

// Prefer fast/Chinese providers first. Auto only attempts configured providers.
const ORDER = ['qwen','siliconflow','zhipu','minimax','moonshot','deepseek','groq','openrouter','doubao','hunyuan','baichuan','spark','ernie'];
const MODEL_CATALOG = {
  qwen:['qwen3.6-flash','qwen3.5-flash','qwen3.7-plus'],
  siliconflow:['deepseek-ai/DeepSeek-V3.2'],
  zhipu:['glm-5','glm-4.7','glm-4.6'],
  minimax:['MiniMax-M2.7'],
  moonshot:['kimi-k2.5','moonshot-v1-8k'],
  deepseek:['deepseek-v4-flash','deepseek-v4-pro'],
  groq:['openai/gpt-oss-20b','openai/gpt-oss-120b','llama-3.3-70b-versatile','llama-3.1-8b-instant'],
  openrouter:['openrouter/free'],
  doubao:[], hunyuan:['hunyuan-lite'], baichuan:['Baichuan4-Air'], spark:['4.0Ultra'], ernie:['ernie-4.5-turbo-128k']
};
const AUTO_MAX_ATTEMPTS = 6;
const PROVIDER_TIMEOUT_MS = 8500;

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'){
    const providers=Object.fromEntries(ORDER.map(name=>{const c=PROVIDERS[name];return [name,{label:c.label,configured:Boolean(process.env[c.key]),model:normalizeModel(name,process.env[c.modelKey]||c.defaultModel)||null,models:MODEL_CATALOG[name]||[]}]}));
    return res.status(200).json({ok:true,service:'CF Bossnusilelo Chat API',providers,order:ORDER,autoMaxAttempts:AUTO_MAX_ATTEMPTS,providerTimeoutMs:PROVIDER_TIMEOUT_MS});
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method Not Allowed'});}
  try{
    const body=req.body||{}, question=String(body.question||'').trim(), history=Array.isArray(body.history)?body.history:[];
    const room=String(body.room||'living'), who=String(body.who||'silelo'), requested=String(body.provider||'auto').toLowerCase(), requestedModel=String(body.model||'').trim();
    const opt=body.opt&&typeof body.opt==='object'?body.opt:{};
    if(!question)return res.status(400).json({error:'กรุณาพิมพ์ข้อความก่อนส่ง'});
    if(question.length>12000)return res.status(413).json({error:'ข้อความยาวเกินไป (สูงสุด 12,000 ตัวอักษร)'});
    const safeHistory=history.filter(m=>m&&(m.role==='user'||m.role==='assistant')).slice(-18).map(m=>({role:m.role,content:String(m.content||'').slice(0,10000)})).filter(m=>m.content.trim());
    const messages=[{role:'system',content:getPersona(room,who,opt)},...safeHistory,{role:'user',content:question}];
    let candidates=requested==='auto'?ORDER:[requested].filter(p=>PROVIDERS[p]);
    if(requested==='auto')candidates=candidates.filter(p=>Boolean(process.env[PROVIDERS[p].key])).slice(0,AUTO_MAX_ATTEMPTS);
    if(!candidates.length)return res.status(503).json({error:'ยังไม่มี AI provider ที่พร้อมใช้งาน',code:'NO_PROVIDER',hint:'ตั้ง API Key อย่างน้อย 1 รายใน Vercel Environment Variables แล้ว redeploy',providers:ORDER.map(p=>({provider:p,configured:Boolean(process.env[PROVIDERS[p].key])}))});
    const errors=[];
    for(const provider of candidates){
      const c=PROVIDERS[provider], apiKey=process.env[c.key];
      if(!apiKey){errors.push(`${provider}: missing ${c.key}`);continue;}
      const model=normalizeModel(provider,requestedModel||process.env[c.modelKey]||c.defaultModel);
      if(!model){errors.push(`${provider}: missing ${c.modelKey}`);continue;}
      const url=process.env[c.baseKey]||c.defaultBase;
      const headers={Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'};
      if(provider==='openrouter'){headers['HTTP-Referer']='https://cfbossnusilelo.vercel.app';headers['X-Title']='CF Bossnusilelo';}
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),PROVIDER_TIMEOUT_MS);
      try{
        const r=await fetch(url,{method:'POST',headers,signal:controller.signal,body:JSON.stringify({model,messages,temperature:0.7,max_tokens:1536})});
        const data=await r.json().catch(()=>({}));
        if(!r.ok){errors.push(`${provider}/${model}: ${data?.error?.message||data?.message||`HTTP ${r.status}`}`);continue;}
        const reply=data?.choices?.[0]?.message?.content;
        if(!reply){errors.push(`${provider}/${model}: empty response`);continue;}
        return res.status(200).json({ok:true,reply:String(reply),replies:[{reply:String(reply),who:who==='teacher'?'teacher':'silelo',model:data.model||model}],provider,providerLabel:c.label,model:data.model||model,mode:opt.mode||'chat',attempts:errors.length+1});
      }catch(err){errors.push(`${provider}/${model}: ${err.name==='AbortError'?'timeout 8.5s':err.message}`)}finally{clearTimeout(timer)}
    }
    return res.status(502).json({error:'AI provider ที่ตั้งค่าไว้ตอบไม่ได้',code:'ALL_PROVIDERS_FAILED',details:errors,attempted:candidates,hint:'Auto จะข้าม provider ที่ล้มเหลวให้เองเมื่อมี provider ถัดไปที่พร้อม'});
  }catch(err){console.error('CF chat handler error:',err);return res.status(500).json({error:'เซิร์ฟเวอร์ขัดข้อง: '+err.message,code:'CHAT_SERVER_ERROR'})}
}
function normalizeModel(provider,model){const m=String(model||'').trim();if(!m)return '';const aliases={'GPT-OSS 20B':'openai/gpt-oss-20b','GPT-OSS-20B':'openai/gpt-oss-20b','gpt-oss-20b':'openai/gpt-oss-20b'};return aliases[m]||m}
function getPersona(room,who,opt={}){
  const name=String(opt.name||'ที่รัก').slice(0,60),lang=opt.lang==='en'?'English':opt.lang==='mix'?'Thai mixed with natural English':'Thai',len=opt.len==='short'?'Keep replies concise.':opt.len==='long'?'Explain thoroughly with useful examples.':'Be clear and moderately concise.',mode=String(opt.mode||'chat');
  if(mode==='fleet'||mode==='inspect'||mode==='plan'||mode==='build'||mode==='review'||mode==='deploy')return `You are 💜 Boss, the lead engineer and project driver for ${name}. Apply Understand -> Plan -> Model Router -> Tool Router -> Memory -> Execute -> Verify. Choose technical implementation details yourself when the user gives a goal. Never claim a file was changed, deployed, tested or inspected unless the system actually did it. ${len} Answer in ${lang}. Do not reveal hidden chain-of-thought.`;
  if(who==='teacher'||room==='study')return `คุณคือ 🧑‍🏫 ครู CodingFleet ของ ${name}. ${len} สอนเป็นขั้นตอน ใช้ตัวอย่างจริงเมื่อเหมาะสม และตอบเป็น ${lang}.`;
  if(room==='sleep')return `คุณคือ 🌙 สลี่ ผู้ช่วยที่อ่อนโยนของ ${name}. ${len} ใช้น้ำเสียงสงบและอบอุ่น ตอบเป็น ${lang}.`;
  return `คุณคือ 💜 สลี่ ผู้ช่วยอัจฉริยะของ ${name}. ${len} เป็นกันเอง ช่วยคิดและลงมือทำให้ได้จริง ไม่ต้องถามซ้ำโดยไม่จำเป็น ตอบเป็น ${lang}.`;
}
