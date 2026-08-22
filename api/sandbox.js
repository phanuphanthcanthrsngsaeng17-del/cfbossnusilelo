const DEFAULT_JUDGE0 = 'https://ce.judge0.com';

const FALLBACK_LANGUAGES = [
  [71,'Python 3'],[63,'JavaScript'],[62,'Java'],[54,'C++'],[50,'C'],[73,'Rust'],[60,'Go'],
  [68,'PHP'],[72,'Ruby'],[78,'Kotlin'],[83,'Swift'],[74,'TypeScript'],[80,'R'],[81,'Scala'],
  [51,'C#'],[75,'C'],[76,'C++'],[46,'Bash'],[82,'SQL'],[55,'Objective-C']
].map(([id,name])=>({id,name}));

function baseUrl(){ return String(process.env.JUDGE0_URL || DEFAULT_JUDGE0).replace(/\/$/,''); }

async function readJson(r){
  const text = await r.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {error:text.slice(0,2000)}; }
}

module.exports = async (req,res)=>{
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS') return res.status(204).end();

  const base = baseUrl();
  try{
    if(req.method==='GET'){
      const r = await fetch(`${base}/languages`);
      if(!r.ok) return res.status(200).json({ok:false,languages:FALLBACK_LANGUAGES,source:'fallback'});
      const languages = await r.json();
      return res.status(200).json({ok:true,languages,source:'judge0'});
    }
    if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

    const body = req.body || {};
    const source_code = String(body.source_code || '');
    const language_id = Number(body.language_id);
    const stdin = String(body.stdin || '');
    if(!source_code.trim()) return res.status(400).json({error:'กรุณาใส่โค้ดก่อนรัน'});
    if(!Number.isInteger(language_id) || language_id < 1) return res.status(400).json({error:'language_id ไม่ถูกต้อง'});
    if(source_code.length > 50000) return res.status(413).json({error:'โค้ดยาวเกิน 50,000 ตัวอักษร'});
    if(stdin.length > 10000) return res.status(413).json({error:'Input ยาวเกิน 10,000 ตัวอักษร'});

    const payload = {
      source_code, language_id, stdin,
      cpu_time_limit: 5,
      wall_time_limit: 10,
      memory_limit: 128000,
      max_output_size: 10000,
      enable_network: false
    };
    const submit = await fetch(`${base}/submissions?base64_encoded=false&wait=true`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    const data = await readJson(submit);
    if(!submit.ok) return res.status(submit.status).json({error:data.error || data.message || 'Sandbox runner error',details:data});
    return res.status(200).json({ok:true,...data,runner:base});
  }catch(err){
    return res.status(502).json({error:'Sandbox runner ติดต่อไม่ได้',details:String(err.message||err)});
  }
};
