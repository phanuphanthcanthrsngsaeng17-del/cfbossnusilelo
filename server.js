// ============================================================
// CF Bossnusilelo V.2 — production-hardened server
// - Admin endpoints are fail-closed behind ADMIN_TOKEN.
// - Chat handler is hot-reloadable for trusted admin use.
// ============================================================
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const CHAT_HANDLER_PATH = path.join(__dirname, 'api/chat.js');
let chatRouter = require(CHAT_HANDLER_PATH);

const HTML_FILE = path.join(__dirname, 'public', 'index.html');
const BACKUP_DIR = path.join(__dirname, 'public', 'backups');
const MAX_BODY_BYTES = 1024 * 1024;

function wrapRes(res) {
  return {
    setHeader: (k, v) => res.setHeader(k, v),
    status: function (c) { res.statusCode = c; return this; },
    json: function (o) {
      res.writeHead(res.statusCode || 200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(o));
    }
  };
}

function adminTokenFromRequest(req) {
  const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const headerToken = req.headers['x-admin-token'];
  return typeof headerToken === 'string' ? headerToken.trim() : '';
}

function adminAuthorized(req) {
  const expected = process.env.ADMIN_TOKEN;
  const presented = adminTokenFromRequest(req);
  if (!expected || expected.length < 32 || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res) {
  if (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN.length < 32) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'ADMIN_TOKEN is not configured' });
  }
  if (!adminAuthorized(req)) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="CF Bossnusilelo Admin"');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return null;
}

function sysInfo(req) {
  const total = os.totalmem(), free = os.freemem();
  let disk = { total: null, free: null };
  try {
    const st = fs.statfsSync(__dirname);
    disk = { total: st.blocks * st.bsize, free: st.bfree * st.bsize };
  } catch { /* statfs ไม่รองรับบาง platform — ข้าม */ }
  const gb = n => n == null ? null : Math.round((n / 1073741824) * 10) / 10;
  return {
    unlocked: true,
    pid: process.pid,
    node: process.version,
    platform: os.platform() + ' ' + os.release(),
    arch: os.arch(),
    uptime: Math.round(process.uptime()),
    cpu: { load1: os.loadavg()[0], load5: os.loadavg()[1], load15: os.loadavg()[2], cores: os.cpus().length, model: os.cpus()[0]?.model?.trim() },
    ram: { total: gb(total), free: gb(free), used: gb(total - free), pct: Math.round(((total - free) / total) * 100) },
    disk: { total: gb(disk.total), free: gb(disk.free) }
  };
}

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
    delete require.cache[require.resolve(CHAT_HANDLER_PATH)];
    chatRouter = require(CHAT_HANDLER_PATH);
    if (global.__STATS) global.__STATS.reloads = (global.__STATS.reloads || 0) + 1;
    return { ok: true, reloaded: new Date().toISOString(), reloads: global.__STATS?.reloads || 0 };
  } catch (e) {
    console.error('Hot reload failed:', e.message);
    return { ok: false, error: 'Hot reload failed' };
  }
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  const R = wrapRes(res);

  // ---------- ADMIN API: every endpoint is authenticated ----------
  if (req.method === 'GET' && url === '/api/sys') {
    const denied = requireAdmin(req, R);
    if (denied) return;
    return R.json(sysInfo(req));
  }

  if (req.method === 'POST' && url === '/api/unlock') {
    const denied = requireAdmin(req, R);
    if (denied) return;
    return R.json({ unlocked: true, message: '🔓 SUPER ADMIN authenticated' });
  }

  if (req.method === 'POST' && url === '/api/backup') {
    const denied = requireAdmin(req, R);
    if (denied) return;
    try {
      const b = createBackup();
      return R.json({ ok: true, ...b, message: 'สำรองข้อมูลสำเร็จ' });
    } catch (e) {
      console.error('Backup failed:', e.message);
      return R.status(500).json({ error: 'สำรองไม่สำเร็จ' });
    }
  }

  if (req.method === 'POST' && url === '/api/reload') {
    const denied = requireAdmin(req, R);
    if (denied) return;
    const result = reloadHeart();
    return R.status(result.ok ? 200 : 500).json(result);
  }

  // ---------- Static backup downloads: authenticated only ----------
  if (req.method === 'GET' && url.startsWith('/backups/')) {
    const denied = requireAdmin(req, R);
    if (denied) return;
    const f = path.join(BACKUP_DIR, path.basename(url));
    if (fs.existsSync(f)) {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="' + path.basename(f) + '"',
        'Cache-Control': 'no-store'
      });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); return res.end('ไม่พบไฟล์สำรอง');
  }

  if (req.method === 'GET' && (url === '/' || url === '/chat' || url === '/game.html' || url === '/shadcn-demo.html' || url === '/ui-lab.html' || url === '/call.html' || url === '/admin.html' || /^\/chat\/[\w-]+\/?$/.test(url))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const page = url === '/game.html' ? __dirname + '/public/game.html' : url === '/shadcn-demo.html' ? __dirname + '/public/shadcn-demo.html' : url === '/ui-lab.html' ? __dirname + '/public/ui-lab.html' : url === '/call.html' ? __dirname + '/public/call.html' : url === '/admin.html' ? __dirname + '/public/admin.html' : HTML_FILE;
    res.end(fs.readFileSync(page));
  } else {
    let body = '';
    let size = 0;
    let tooLarge = false;
    req.on('data', c => {
      size += c.length;
      if (size <= MAX_BODY_BYTES) body += c;
      else tooLarge = true;
    });
    req.on('end', () => {
      if (tooLarge) return R.status(413).json({ error: 'Request body too large' });
      try { req.body = body ? JSON.parse(body) : {}; }
      catch { return R.status(400).json({ error: 'Invalid JSON body' }); }
      chatRouter(req, wrapRes(res));
    });
  }
});

server.listen(process.env.PORT || 3000, () => console.log('CF Bossnusilelo server on :' + (process.env.PORT || 3000)));

module.exports = { server, adminAuthorized, requireAdmin };
