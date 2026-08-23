import { NextResponse } from 'next/server'
import { routeToModel } from '../../../lib/models/router'

export const runtime = 'nodejs'

export async function POST(req) {
  try {
    const form = await req.formData()
    const instruction = String(form.get('instruction') || 'สร้างแอปให้สมบูรณ์ตามเนื้อหา')
    const files = form.getAll('files')
    const apiKey = String(form.get('apiKey') || '') || process.env.OPENROUTER_API_KEY
    if (!apiKey) return NextResponse.json({ success: false, stage: 'key', error: 'ต้องใส่ API Key ก่อนใช้งาน' }, { status: 401 })

    const fileMeta = files.map(f => ({ name: f?.name || 'file', type: f?.type || 'application/octet-stream', size: f?.size || 0 }))
    const analysis = await routeToModel([
      { role: 'system', content: 'คุณเป็น planner ของ Boss Agent ตอบ JSON เท่านั้น: {"goal":string,"type":string,"requirements":string[],"steps":string[]}. ห้ามอ้างว่าได้แก้ไฟล์หรือ deploy แล้ว' },
      { role: 'user', content: `คำสั่ง: ${instruction}\nไฟล์: ${JSON.stringify(fileMeta)}` },
    ], 'auto', apiKey)

    let plan
    try { plan = JSON.parse(analysis.reply) } catch { plan = { goal: instruction, type: 'unknown', requirements: [], steps: ['วิเคราะห์งาน', 'วางแผน', 'ดำเนินการ', 'ตรวจสอบ'] } }
    return NextResponse.json({ success: true, stage: 'planned', analysis: plan, plan: { steps: plan.steps || [], status: 'planned' }, changes: [], verification: { status: 'not-run' }, deploy: { status: 'not-run' }, files: fileMeta })
  } catch (error) {
    return NextResponse.json({ success: false, stage: 'error', error: error.message }, { status: 500 })
  }
}
