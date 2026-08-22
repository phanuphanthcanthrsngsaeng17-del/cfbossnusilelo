(() => {
  'use strict';
  const boot = () => {
    const input = document.querySelector('#input');
    const row = input?.closest('.row, .inputrow');
    if (!input || !row) return;

    // Compact chat: keep the conversation dense without changing readability.
    const style = document.createElement('style');
    style.textContent = `
      .msg{margin:10px auto!important;gap:8px!important}
      .bubble{padding:10px 13px!important;line-height:1.58!important;border-radius:15px!important}
      .meta{margin:3px 6px!important}
      .copy-msg{margin:2px 6px 0;border:1px solid #292933;background:#101015;color:#a7a7b2;border-radius:8px;padding:4px 7px;font-size:10px;cursor:pointer}
      .copy-msg:hover{color:#fff;border-color:#6841a0}
      .boss-call{width:46px;height:46px;flex:none;border:1px solid #5b3b82;border-radius:14px;background:linear-gradient(145deg,#241533,#17111e);color:#f3e8ff;font-size:20px;cursor:pointer;box-shadow:0 0 18px #9b5cff18}
      .boss-call:hover{border-color:#9b5cff;background:#2a1938}
      .boss-presence{position:fixed;right:14px;top:76px;z-index:20;display:none;padding:7px 10px;border:1px solid #3a2d52;border-radius:10px;background:#15121beF;color:#d9c8ee;font-size:10px;backdrop-filter:blur(14px)}
    `;
    document.head.appendChild(style);

    // Add a single 👑 control beside the composer input.
    if (!document.querySelector('.boss-call')) {
      const crown = document.createElement('button');
      crown.className = 'boss-call';
      crown.type = 'button';
      crown.title = 'เรียก Boss';
      crown.setAttribute('aria-label', 'เรียก Boss');
      crown.textContent = '👑';
      crown.addEventListener('click', () => {
        input.focus();
        const p = document.querySelector('.boss-presence');
        if (p) {
          p.textContent = '👑 Boss มาแล้วครับ';
          p.style.display = 'block';
          clearTimeout(window.__bossPresenceTimer);
          window.__bossPresenceTimer = setTimeout(() => { p.style.display = 'none'; }, 1800);
        }
      });
      row.insertBefore(crown, row.firstChild);
    }

    if (!document.querySelector('.boss-presence')) {
      const p = document.createElement('div');
      p.className = 'boss-presence';
      p.textContent = '👑 Boss พร้อม';
      document.body.appendChild(p);
    }

    const addCopyButtons = () => {
      document.querySelectorAll('.msg.bot .bubble').forEach(bubble => {
        if (bubble.parentElement.querySelector('.copy-msg')) return;
        const btn = document.createElement('button');
        btn.className = 'copy-msg';
        btn.type = 'button';
        btn.textContent = '📋 คัดลอก';
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(bubble.innerText);
            btn.textContent = '✓ คัดลอกแล้ว';
            setTimeout(() => { btn.textContent = '📋 คัดลอก'; }, 1400);
          } catch {
            btn.textContent = 'คัดลอกไม่ได้';
            setTimeout(() => { btn.textContent = '📋 คัดลอก'; }, 1400);
          }
        });
        bubble.parentElement.appendChild(btn);
      });
    };

    addCopyButtons();
    new MutationObserver(addCopyButtons).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
