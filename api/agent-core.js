// CF Boss Core — shared orchestration primitives for the serverless app.
export const PIPELINE = ['Understand','Plan','Model Router','Tool Router','Memory','Execute','Verify'];

export function createWorkOrder(goal, context = {}) {
  return {
    id: `wo_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    goal: String(goal || '').trim(),
    status: 'planned',
    pipeline: PIPELINE.map((name, index) => ({ id: index + 1, name, status: index === 0 ? 'ready' : 'pending' })),
    context,
    createdAt: new Date().toISOString()
  };
}

export function buildPlan(goal) {
  return [
    { id:'understand', title:'Understand', action:'จับเป้าหมาย ข้อจำกัด และเกณฑ์สำเร็จ', status:'ready' },
    { id:'plan', title:'Plan', action:'แตกงานเป็นขั้นตอนที่ทำได้จริง', status:'pending' },
    { id:'model', title:'Model Router', action:'เลือกโมเดลจาก Auto Registry และ fallback ที่พร้อมใช้', status:'pending' },
    { id:'tools', title:'Tool Router', action:'เลือกเฉพาะเครื่องมือที่จำเป็นและมีสิทธิ์', status:'pending' },
    { id:'memory', title:'Memory', action:'ใช้บริบทของห้องและการตัดสินใจก่อนหน้า', status:'pending' },
    { id:'execute', title:'Execute', action:'ลงมือผ่าน capability ที่ระบบอนุญาต', status:'pending' },
    { id:'verify', title:'Verify', action:'ตรวจผลจริงก่อนรายงานว่าสำเร็จ', status:'pending' }
  ].map(x => ({...x, goal: String(goal || '').slice(0, 500)}));
}

export function summarizeExecution(results = []) {
  return results.map(r => ({ id:r.id, status:r.status, output:r.output ?? null, error:r.error ?? null }));
}
