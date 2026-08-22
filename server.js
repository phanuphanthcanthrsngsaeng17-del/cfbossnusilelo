// ============================================================
// CF Bossnusilelo V.2 — SUPER ADMIN MODE 🔓
// - /api/sys     : สถานะระบบจริง (CPU/RAM/ดิสก์/อัปไทม์)
// - /api/backup  : สำรองไฟล์ทั้งโปรเจกต์เป็น zip → ลิงก์ดาวน์โหลด
// - /api/reload  : รีโหลดโค้ดหัวใจ (api/chat.js) แบบร้อน ไม่ต้องรีบูต
// - /api/unlock  : สลับโหมด 🔓 SUPER ADMIN (สิทธิ์เจ้าของ)
// - ระบบ hot-reload: แก้ api/chat.js → POST /api/reload → มีผลทันที
// ============================================================
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

// ตัวแปรชี้ handler — เปลี่ยนได้ตอนรัน (hot reload)
let chatRouter = require(path.join(__dirname, 'api/chat.js'));

const HTML_FILE = path.join(__dirname, 'public', 'index.html');
const CHAT_FILE = path.join(__dirname, 'public', 'chat.html');
const BACKUP_DIR = path.join(__dirname, 'public', 'backups');

function wrapRes(res) {
  return {
    setHeader: (k, v) => res.setHeader(k, v),
    status: function (c) { res.statusCode = c; return this; },
    json: function (o) {
      res.writeHead(res.statusCode || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(o));
    }
  };
}

function unlockState() {
  return !!global.SUPER_ADMIN;
}

function sysInfo() {
  const total = os.totalmem(), free = os.freemem();
  let disk = { total: null, free: null };
  try {
    const st = fs.statfsSync(__dirname);
    disk = { total: st.blocks * st.bsize, free: st.bfree * st.bsize };
  } catch { /* statfs ไม่รองรับบาง platform — ข้าม */ }
  const gb = n => Math.round((n / 1073741824) * 10) / 10;
  return {
    unlocked: unlockState(),
    pid: process.pid,
    node: process.version,
    platform: os.platform() + ' ' + os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: Math.round(process.uptime()),
    cpu: { load1: os.loadavg()[0], load5: os.loadavg()[1], load15: os.loadavg()[2], cores: os.cpus().length, model: os.cpus()[0]?.model?.trim() },
    ram: { total: gb(total), free: gb(free), used: gb(total - free), pct: Math.round(((total - free) / total) * 100) },
    disk: { total: gb(disk.total), free: gb(disk.free) },
    cwd: __dirname
  };
}

// zip โปรเจกต์ (ไม่รวม node_modules/.git/ซิปเก่า) — ใช้คำสั่ง zip ในเครื่อง
function createBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const out = path.join(BACKUP_DIR, `cfbossnusilelo-${ts}.zip`);
  const args = ['-r', out, 'public', 'api', 'README.md', 'FIX-YOURSELF.md', 'server.js', '-x', '*.bak', '-x', '*/backups/*', '-x', '*/node_modules/*'];
  execFileSync('zip', args, { cwd: __dirname, stdio: 'pipe' });
  return { file: out, url: '/backups/' + path.basename(out), size: fs.statSync(out).size };
}

function reloadHeart() {
  try {
    delete require.cache[require.resolve(path.join(__dirname, 'api/chat.js'))];
    chatRouter = require(path.join(__dirname, 'api/chat.js'));
    if (global.__STATS) global.__STATS.reloads = (global.__STATS.reloads || 0) + 1;
    return { ok: true, reloaded: new Date().toISOString(), reloads: global.__STATS?.reloads || 0 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function serveChatPage(res) {
  let html = fs.readFileSync(CHAT_FILE, 'utf8');
  if (!html.includes('/boss-ui.js')) {
    html = html.replace('</body>', '<script src="/boss-ui.js?v=1"></script></body>');
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const R = wrapRes(res);

  if (req.method === 'GET' && url === '/api/sys') {
    return R.json(sysInfo());
  }

  if (req.method === 'POST' && url === '/api/unlock') {
    global.SUPER_ADMIN = !global.SUPER_ADMIN;
    console.log('🔓 SUPER ADMIN =', global.SUPER_ADMIN);
    return R.json({ unlocked: unlockState(), message: global.SUPER_ADMIN ? '🔓 ปลดล็อกสุดขีดแล้ว!' : '🔒 ล็อกกลับแล้ว' });
  }

  if (req.method === 'POST' && url === '/api/backup') {
    try {
      const b = createBackup();
      return R.json({ ok: true, ...b, message: 'สำรองข้อมูลสำเร็จ' });
    } catch (e) { return R.status(500).json({ error: 'สำรองไม่สำเร็จ: ' + e.message }); }
  }

  if (req.method === 'POST' && url === '/api/reload') {
    const r = reloadHeart();
    return R.json(r);
  }

  if (req.method === 'GET' && url.startsWith('/backups/')) {
    const f = path.join(BACKUP_DIR, path.basename(url));
    if (fs.existsSync(f)) {
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="' + path.basename(f) + '"' });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); return res.end('ไม่พบไฟล์สำรอง');
  }

  if (req.method === 'GET' && /^\/chat\/[\w-]+\/?$/.test(url)) {
    return serveChatPage(res);
  }

  if (req.method === 'GET' && (url === '/' || url === '/chat' || url === '/game.html' || url === '/shadcn-demo.html' || url === '/ui-lab.html' || url === '/call.html' || url === '/admin.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const page = url === '/game.html' ? __dirname + '/public/game.html' : url === '/shadcn-demo.html' ? __dirname + '/public/shadcn-demo.html' : url === '/ui-lab.html' ? __dirname + '/public/ui-lab.html' : url === '/call.html' ? __dirname + '/public/call.html' : url === '/admin.html' ? __dirname + '/public/admin.html' : HTML_FILE;
    res.end(fs.readFileSync(page));
  } else {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { req.body = JSON.parse(body); } catch { req.body = {}; }
      chatRouter(req, wrapRes(res));
    });
  }
}).listen(process.env.PORT || 3000, () => console.log('🔓 CF Bossnusilelo V.2 (SUPER ADMIN) on :' + (process.env.PORT || 3000)));
