// CF Room Sandbox — Judge0 adapter. Never executes code inside Vercel.
const DEFAULT_URL='https://ce.judge0.com';
const base=()=> (process.env.JUDGE0_URL||DEFAULT_URL).replace(/\/$/,'');
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method==='GET'){
      const r=await fetch(`${base()}/languages/`); const data=await r.json().catch(()=>[]);
      if(!r.ok)return res.status(r.status).json({error:'โหลดรายการภาษาไม่ได้',details:data});
      return res.status(200).json({ok:true,languages:data});
    }
    if(req.method!=='POST')return res.status(405).json({error:'Method Not Allowed'});
    const b=req.body||{},source=String(b.source_code||''),language_id=Number(b.language_id),stdin=String(b.stdin||'');
    if(!source.trim())return res.status(400).json({error:'กรุณาใส่โค้ดก่อนรัน'});
    if(!Number.isInteger(language_id))return res.status(400).json({error:'กรุณาเลือกภาษา'});
    if(source.length>200000)return res.status(413).json({error:'โค้ดยาวเกิน 200,000 ตัวอักษร'});
    const submit=await fetch(`${base()}/submissions?base64_encoded=false&wait=false`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({source_code:source,language_id,stdin})});
    const created=await submit.json().catch(()=>({}));
    if(!submit.ok||!created.token)return res.status(submit.status||502).json({error:'ส่งโค้ดเข้า sandbox ไม่สำเร็จ',details:created});
    const token=created.token,started=Date.now();
    while(Date.now()-started<25000){
      await new Promise(r=>setTimeout(r,700));
      const rr=await fetch(`${base()}/submissions/${encodeURIComponent(token)}?base64_encoded=false`); const result=await rr.json().catch(()=>({}));
      if(!rr.ok)return res.status(rr.status).json({error:'อ่านผล sandbox ไม่สำเร็จ',details:result});
      if(result.status&&result.status.id>2)return res.status(200).json({ok:true,token,status:result.status,stdout:result.stdout||'',stderr:result.stderr||'',compile_output:result.compile_output||'',message:result.message||'',time:result.time||null,memory:result.memory||null});
    }
    return res.status(202).json({ok:false,pending:true,token,message:'sandbox ยังประมวลผลอยู่'});
  }catch(err){return res.status(502).json({error:'Sandbox เชื่อมต่อไม่ได้',details:err.message,hint:'ตั้ง JUDGE0_URL ใน Vercel หากต้องการใช้ instance ของเราเอง'});}
}