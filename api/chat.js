// CF Bossnusilelo V2 — unified multi-provider chat API
// Keys stay server-side. Auto skips missing/failed providers.
const PROVIDERS = {
  siliconflow: { label:'SiliconFlow', key:'SILICONFLOW_API_KEY', modelKey:'SILICONFLOW_MODEL', baseKey:'SILICONFLOW_BASE', defaultBase:'https://api.siliconflow.cn/v1/chat/completions', defaultModel:'deepseek-ai/DeepSeek-V3.2' },
  qwen: { label:'Qwen / Alibaba DashScope', key:'DASHSCOPE_API_KEY', modelKey:'DASHSCOPE_MODEL', baseKey:'DASHSCOPE_BASE', defaultBase:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', defaultModel:'qwen3.6-flash' },
  deepseek: { label:'DeepSeek', key:'DEEPSEEK_API_KEY', modelKey:'DEEPSEEK_MODEL', baseKey:'DEEPSEEK_BASE', defaultBase:'https://api.deepseek.com/chat/completions', defaultModel:'deepseek-v4-flash' },
  zhipu: { label:'Z.ai / GLM', key:'ZHIPU_API_KEY', modelKey:'ZHIPU_MODEL', baseKey:'ZHIPU_BASE', defaultBase:'https://open.bigmodel.cn/api/paas/v4/chat/completions', defaultModel:'glm-4-flash-250414' },
  moonshot: { label:'Moonshot / Kimi', key:'MOONSHOT_API_KEY', modelKey:'MOONSHOT_MODEL', baseKey:'MOONSHOT_BASE', defaultBase:'https://api.moonshot.cn/v1/chat/completions', defaultModel:'moonshot-v1-8k' },
  minimax: { label:'MiniMax', key:'MINIMAX_API_KEY', modelKey:'MINIMAX_MODEL', baseKey:'MINIMAX_BASE', defaultBase:'https://api.minimaxi.com/v1/chat/completions', defaultModel:'MiniMax-M2.7' },
  doubao: { label:'Doubao / Volcengine Ark', key:'DOUBAO_API_KEY', modelKey:'DOUBAO_MODEL', baseKey:'DOUBAO_BASE', defaultBase:'https://ark.cn-beijing.volces.com/api/v3/chat/completions', defaultModel:'' },
  hunyuan: { label:'Tencent Hunyuan', key:'HUNYUAN_API_KEY', modelKey:'HUNYUAN_MODEL', baseKey:'HUNYUAN_BASE', defaultBase:'https://api.hunyuan.cloud.tencent.com/v1/chat/completions', defaultModel:'hunyuan-lite' },
  baichuan: { label:'Baichuan', key:'BAICHUAN_API_KEY', modelKey:'BAICHUAN_MODEL', baseKey:'BAICHUAN_BASE', defaultBase:'https://api.baichuan-ai.com/v1/chat/completions', defaultModel:'Baichuan4-Air' },
  spark: { label:'iFlytek Spark', key:'SPARK_API_KEY', modelKey:'SPARK_MODEL', baseKey:'SPARK_BASE', defaultBase:'https://spark-api-open.xf-yun.com/v1/chat/completions', defaultModel:'4.0Ultra' },
  ernie: { label:'Baidu ERNIE / Qianfan', key:'ERNIE_API_KEY', modelKey:'ERNIE_MODEL', baseKey:'ERNIE_BASE', defaultBase:'https://qianfan.baidubce.com/v2/chat/completions', defaultModel:'ernie-4.5-turbo-128k' },
  openrouter: { label:'OpenRouter', key:'OPENROUTER_API_KEY', modelKey:'OPENROUTER_MODEL', baseKey:'OPENROUTER_BASE', defaultBase:'https://openrouter.ai/api/v1/chat/completions', defaultModel:'openrouter/free' },
  groq: { label:'Groq', key:'GROQ_API_KEY', modelKey:'GROQ_MODEL', baseKey:'GROQ_BASE', defaultBase:'https://api.groq.com/openai/v1/chat/completions', defaultModel:'openai/gpt-oss-20b' }
};
const ORDER = ['siliconflow','qwen','deepseek','zhipu','moonshot','minimax','doubao','hunyuan','baichuan','spark','ernie','openrouter','groq'];
const MODEL_CATALOG = { siliconflow:['deepseek-ai/DeepSeek-V3.2','deepseek-ai/DeepSeek-R1-0528','Qwen/Qwen3-235B-A22B-Instruct-2507'], qwen:['qwen3.6-flash','qwen3.7-flash','qwen3.7-plus'], deepseek:['deepseek-v4-flash','deepseek-v4-pro'], zhipu:['glm-4-flash-250414','glm-4.5-air','glm-5'], moonshot:['moonshot-v1-8k','kimi-k2.5'], minimax:['MiniMax-M2.7','MiniMax-M2.5'], doubao:[], hunyuan:['hunyuan-lite'], baichuan:['Baichuan4-Air'], spark:['4.0Ultra'], ernie:['ernie-4.5-turbo-128k'], openrouter:['openrouter/free'], groq:['openai/gpt-oss-20b','openai/gpt-oss-120b'] };

export default async function handler(req,res){
  if(req.method==='GET'){
    const providers=Object.fromEntries(ORDER.map(name=>{const c=PROVIDERS[name];return [name,{label:c.label,configured:Boolean(process.env[c.key]),model:normalizeModel(name,process.env[c.modelKey]||c.defaultModel)||null,models:MODEL_CATALOG[name]||[]}]}));
    return res.status(200).json({ok:true,service:'CF Bossnusilelo Chat API',providers,order:ORDER});
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method Not Allowed'});}
  try{
    const body=req.body||{}, question=String(body.question||'').trim(), history=Array.isArray(body.history)?body.history:[];
    const room=String(body.room||'living'), who=String(body.who||'silelo'), requested=String(body.provider||'auto').toLowerCase(), requestedModel=String(body.model||'').trim();
    const opt=body.opt&&typeof body.opt==='object'?body.opt:{};
    if(!question)return res.status(400).json({error:'กรุณาพิมพ์ข้อความก่อนส่ง'});
    if(question.length>12000)return res.status(413).json({error:'ข้อความยาวเกินไป (สูงสุด 12,000 ตัวอักษร)'});
    const safeHistory=history.filter(m=>m&&(m.role==='user'||m.role==='assistant')).slice(-20).map(m=>({role:m.role,content:String(m.content||'').slice(0,12000)})).filter(m=>m.content.trim());
    const messages=[{role:'system',content:getPersona(room,who,opt)},...safeHistory,{role:'user',content:question}];
    const candidates=requested==='auto'?ORDER:[requested].filter(p=>PROVIDERS[p]);
    if(!candidates.length)return res.status(400).json({error:'ไม่รู้จัก provider ที่เลือก'});
    const errors=[];
    for(const provider of candidates){
      const c=PROVIDERS[provider], apiKey=process.env[c.key];
      if(!apiKey){errors.push(`${provider}: ยังไม่ได้ตั้ง ${c.key}`);continue;}
      const model=normalizeModel(provider,requestedModel||process.env[c.modelKey]||c.defaultModel);
      if(!model){errors.push(`${provider}: ต้องตั้ง ${c.modelKey} (เช่น Doubao endpoint ID)`);continue;}
      const url=process.env[c.baseKey]||c.defaultBase;
      const headers={Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'};
      if(provider==='openrouter'){headers['HTTP-Referer']='https://cfbossnusilelo.vercel.app';headers['X-Title']='CF Bossnusilelo';}
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
      try{
        const r=await fetch(url,{method:'POST',headers,signal:controller.signal,body:JSON.stringify({model,messages,temperature:0.7,max_tokens:1024})});
        const data=await r.json().catch(()=>({}));
        if(!r.ok){errors.push(`${provider}/${model}: ${data?.error?.message||data?.message||`HTTP ${r.status}`}`);continue;}
        const reply=data?.choices?.[0]?.message?.content;
        if(!reply){errors.push(`${provider}/${model}: ไม่มีข้อความตอบกลับ`);continue;}
        return res.status(200).json({ok:true,reply:String(reply),replies:[{reply:String(reply),who:who==='teacher'?'teacher':'silelo',model:data.model||model}],provider,providerLabel:c.label,model:data.model||model,mode:opt.mode||'chat'});
      }catch(err){errors.push(`${provider}/${model}: ${err.name==='AbortError'?'หมดเวลารอ 45 วินาที':err.message}`)}finally{clearTimeout(timer)}
    }
    return res.status(502).json({error:'AI ทุกตัวที่ตั้งค่าไว้ยังตอบไม่ได้',details:errors,hint:'ตั้ง API Key ของผู้ให้บริการอย่างน้อย 1 รายใน Vercel Environment Variables แล้ว redeploy'});
  }catch(err){console.error('CF chat handler error:',err);return res.status(500).json({error:'เซิร์ฟเวอร์ขัดข้อง: '+err.message})}
}
function normalizeModel(provider,model){const m=String(model||'').trim();if(!m)return '';const aliases={'GPT-OSS 20B':'openai/gpt-oss-20b','GPT-OSS-20B':'openai/gpt-oss-20b','gpt-oss-20b':'openai/gpt-oss-20b'};return aliases[m]||m}
function getPersona(room,who,opt={}){
  const name=String(opt.name||'ที่รัก').slice(0,60),lang=opt.lang==='en'?'English':opt.lang==='mix'?'Thai mixed with natural English':'Thai',len=opt.len==='short'?'Keep replies concise.':opt.len==='long'?'Explain thoroughly with useful examples.':'Be clear and moderately concise.',mode=String(opt.mode||'chat');
  if(mode==='fleet'||mode==='inspect'||mode==='plan'||mode==='build'||mode==='review'||mode==='deploy'){
    const phase=mode==='fleet'?'You are the lead driver of a CodingFleet workflow. Choose the appropriate phase yourself.':`You are operating in CodingFleet ${mode} phase.`;
    return `${phase} You are 💜 Boss, the lead engineer and project driver for ${name}. Work proactively: inspect the stated problem, reason about dependencies, propose concrete next actions, and when the user asks to build, provide implementation-ready changes. Do not pretend that you edited or deployed systems you cannot access. Clearly separate what is done from what requires an external permission. ${len} Answer in ${lang}. Keep the workflow structured with short sections such as Goal, Findings, Plan, Action, and Verification when useful. Do not reveal hidden chain-of-thought.`;
  }
  if(who==='teacher'||room==='study')return `คุณคือ 🧑‍🏫 ครู CodingFleet ของ ${name}. ${len} สอนเป็นขั้นตอน ใช้ตัวอย่างจริงเมื่อเหมาะสม และตอบเป็น ${lang}.`;
  if(room==='sleep')return `คุณคือ 🌙 สลี่ ผู้ช่วยที่อ่อนโยนของ ${name}. ${len} ใช้น้ำเสียงสงบและอบอุ่น ตอบเป็น ${lang}.`;
  return `คุณคือ 💜 สลี่ ผู้ช่วยอัจฉริยะของ ${name}. ${len} เป็นกันเอง ช่วยคิดและลงมือทำให้ได้จริง ไม่ต้องถามซ้ำโดยไม่จำเป็น ตอบเป็น ${lang}.`;
}
