import { NextResponse } from 'next/server'
import { routeToModel } from '../../../lib/models/router'

export const runtime = 'nodejs'

export async function POST(req) {
  try {
    const form = await req.formData()
    const message = String(form.get('message') || '').trim()
    const preferred = String(form.get('model') || 'auto')
    const userKey = String(form.get('apiKey') || '')
    const apiKey = userKey || process.env.OPENROUTER_API_KEY
    const files = form.getAll('files')

    if (!message && !files.length) return NextResponse.json({ error: 'กรุณาส่งข้อความหรือไฟล์' }, { status: 400 })
    if (!apiKey) return NextResponse.json({ error: 'ต้องใส่ API Key ก่อนใช้งาน' }, { status: 401 })

    const fileSummary = files.length
      ? `\n\nไฟล์ที่แนบ: ${files.map(f => f?.name || 'ไฟล์').join(', ')}`
      : ''
    const messages = [
      { role: 'system', content: 'คุณคือ Boss Agent ทำงานตามเป้าหมาย วิเคราะห์ วางแผน ลงมือ ตรวจสอบ และรายงานผลอย่างตรงไปตรงมา ห้ามอ้างว่างานเสร็จถ้ายังไม่ได้ตรวจจริง' },
      { role: 'user', content: `${message}${fileSummary}` },
    ]
    const result = await routeToModel(messages, preferred, apiKey)
    return NextResponse.json({ success: true, reply: result.reply, model: result.model, fileCount: files.length })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 503 })
  }
}
