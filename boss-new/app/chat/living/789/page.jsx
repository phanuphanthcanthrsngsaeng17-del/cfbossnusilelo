'use client'

import { useEffect, useRef, useState } from 'react'

const MODELS = [
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' },
  { id: 'deepseek/deepseek-chat-v3-03:free', name: 'DeepSeek V3 03 · Free' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
  { id: 'meta-llama/llama-3.1-70b-instruct:free', name: 'Llama 3.1 70B · Free' },
  { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'auto', name: '🔄 Auto' },
]

export default function BossLivingPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState('auto')
  const [key, setKey] = useState('')
  const [showVault, setShowVault] = useState(false)
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState([])
  const endRef = useRef(null)

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages])

  function saveKey() {
    if (!key.trim()) return
    sessionStorage.setItem('boss_openrouter_key', key.trim())
    setKey('')
    setShowVault(false)
  }

  async function send(e) {
    e.preventDefault()
    if ((!input.trim() && !files.length) || busy) return
    const text = input.trim()
    setInput('')
    setBusy(true)
    setMessages(m => [...m, { role: 'user', content: text || `ส่ง ${files.length} ไฟล์`, time: new Date().toLocaleTimeString('th-TH') }])
    try {
      const form = new FormData()
      form.append('message', text)
      form.append('model', model)
      const saved = sessionStorage.getItem('boss_openrouter_key')
      if (saved) form.append('apiKey', saved)
      for (const file of files) form.append('files', file)
      const res = await fetch('/api/chat', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ระบบตอบกลับไม่สำเร็จ')
      setMessages(m => [...m, { role: 'assistant', content: data.reply, model: data.model, time: new Date().toLocaleTimeString('th-TH') }])
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: `❌ ${err.message}`, error: true }])
    } finally {
      setFiles([])
      setBusy(false)
    }
  }

  return <main className="min-h-screen bg-slate-950 text-white">
    <header className="sticky top-0 z-20 border-b border-indigo-900/50 bg-black/60 p-4 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <div><h1 className="font-bold text-xl">CF BOSS COMMAND CENTER 👑</h1><p className="text-xs text-emerald-400">ONLINE · AUTO</p></div>
        <button onClick={() => setShowVault(true)} className="rounded-lg border border-indigo-500/40 px-3 py-2">🔐 KEY VAULT</button>
      </div>
    </header>
    <section className="mx-auto max-w-4xl p-4"><div className="flex flex-wrap gap-2">{MODELS.map(m => <button key={m.id} onClick={() => setModel(m.id)} className={`rounded-full px-3 py-2 text-sm ${model === m.id ? 'bg-indigo-600' : 'bg-slate-800'}`}>{m.name}</button>)}</div></section>
    <section className="mx-auto max-w-4xl space-y-4 px-4 pb-44">{messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}><div className={`inline-block max-w-[90%] rounded-2xl px-4 py-3 ${m.error ? 'bg-red-950' : m.role === 'user' ? 'bg-indigo-700' : 'bg-slate-800'}`}>{m.content}<div className="mt-2 text-xs opacity-50">{m.model || m.time}</div></div></div>)}<div ref={endRef}/></section>
    <form onSubmit={send} className="fixed bottom-0 left-0 right-0 border-t border-indigo-900/50 bg-black/80 p-3 backdrop-blur"><div className="mx-auto max-w-4xl space-y-2"><input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} className="w-full text-sm"/><div className="flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} disabled={busy} placeholder="ส่งคำสั่งให้บอส..." className="flex-1 rounded-xl bg-slate-800 px-4 py-3 outline-none"/><button disabled={busy} className="rounded-xl bg-indigo-600 px-5 py-3">ส่ง ➤</button></div></div></form>
    {showVault && <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"><div className="w-full max-w-md rounded-2xl bg-slate-900 p-6"><h2 className="mb-4 text-lg font-bold">🔐 AI KEY VAULT</h2><input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="API key" className="mb-4 w-full rounded-lg bg-slate-800 p-3"/><div className="flex justify-end gap-2"><button onClick={() => setShowVault(false)} className="px-4 py-2">ปิด</button><button onClick={saveKey} className="rounded-lg bg-indigo-600 px-4 py-2">บันทึก</button></div></div></div>}
  </main>
}
