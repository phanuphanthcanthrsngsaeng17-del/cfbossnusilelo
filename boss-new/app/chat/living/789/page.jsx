'use client';

import { useRef, useState } from 'react';
import './chat.css';

const MAX_FILES = 50;

export default function Living789() {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('พร้อมทำงาน');

  function chooseFiles() { fileRef.current?.click(); }
  function onFiles(e) {
    const next = Array.from(e.target.files || []).slice(0, MAX_FILES);
    setFiles(next);
    setStatus(next.length ? `เลือกไฟล์ ${next.length} รายการ` : 'ยังไม่ได้เลือกไฟล์');
  }

  function toggleVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return setStatus('เบราว์เซอร์นี้ไม่รองรับเสียง');
    if (listening) return window.__bossRecognition?.stop();
    const r = new Recognition();
    r.lang = 'th-TH';
    r.interimResults = true;
    r.onstart = () => setListening(true);
    r.onend = () => { setListening(false); window.__bossRecognition = null; };
    r.onerror = () => { setListening(false); setStatus('ระบบเสียงผิดพลาด'); };
    r.onresult = e => setMessage(Array.from(e.results).map(x => x[0].transcript).join(''));
    window.__bossRecognition = r;
    r.start();
  }

  async function runAuto() {
    if (!message.trim() && !files.length) return;
    setBusy(true); setStatus('AUTO กำลังทำงาน...');
    try {
      const body = new FormData();
      body.append('message', message);
      files.forEach(f => body.append('files', f));
      const res = await fetch('/api/boss-auto', { method: 'POST', body });
      if (!res.ok) throw new Error(`AUTO ${res.status}`);
      const data = await res.json();
      setStatus(data.status || 'AUTO ทำงานเสร็จ');
    } catch (e) { setStatus(`AUTO ไม่สำเร็จ: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function sendChat() {
    if (!message.trim() || busy) return;
    setBusy(true); setStatus('กำลังส่งแชท...');
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, model: 'auto' }) });
      if (!res.ok) throw new Error(`CHAT ${res.status}`);
      setMessage(''); setStatus('แชทพร้อมรับข้อความถัดไป');
    } catch (e) { setStatus(`แชทไม่สำเร็จ: ${e.message}`); }
    finally { setBusy(false); }
  }

  return (
    <main className="boss-room">
      <header><b>CF BOSS — Living 789</b><span>{status}</span></header>
      <section className="chat-area" aria-label="chat area">
        <div className="welcome">ห้องหลัก • Chat + Auto + Files + Voice</div>
      </section>
      <section className="composer">
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="พิมพ์คำสั่งหรือข้อความ..." />
        <div className="controls">
          <input ref={fileRef} type="file" multiple onChange={onFiles} hidden />
          <button type="button" onClick={toggleVoice} className={listening ? 'active' : ''}>🎙️ เสียง</button>
          <button type="button" onClick={chooseFiles}>📎 ส่งไฟล์/รูป</button>
          <button type="button" onClick={() => window.open('/sandbox-room.html', '_blank')}>🧪 Sandbox</button>
          <button type="button" onClick={() => window.open('https://cfbossnusilelo.vercel.app/', '_blank')}>⚙️ CodingFleet</button>
          <button type="button" onClick={runAuto} disabled={busy}>▶ รัน = AUTO</button>
          <button type="button" onClick={sendChat} disabled={busy}>💬 แชท</button>
        </div>
        {files.length > 0 && <div className="files">{files.map((f, i) => <span key={`${f.name}-${i}`}>{f.name}</span>)}</div>}
      </section>
    </main>
  );
}
