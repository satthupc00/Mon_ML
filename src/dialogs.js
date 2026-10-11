import { I } from './icons.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stack = [];

// Bảng trượt từ dưới lên (điện thoại) / hộp giữa màn hình (PC)
export function sheet(html, { onClose } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  const api = {
    el: scrim.firstElementChild,
    close(v) {
      if (!scrim.isConnected) return;
      scrim.remove();
      stack.splice(stack.indexOf(api), 1);
      onClose?.(v);
    },
  };
  scrim.addEventListener('pointerdown', e => { if (e.target === scrim) api.close(); });
  scrim.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); api.close(); } });
  document.body.appendChild(scrim);
  stack.push(api);
  setTimeout(() => api.el.querySelector('[autofocus]')?.focus(), 60);
  return api;
}
export function closeTopSheet() { const s = stack.at(-1); if (s) { s.close(); return true; } return false; }

export function confirmBox(msg, okLabel = 'Đồng ý') {
  return new Promise(res => {
    const s = sheet(`<h3>${esc(msg)}</h3><p class="sub"></p><div class="row"><button class="btn" data-no>Hủy</button><button class="btn primary" data-ok autofocus>${esc(okLabel)}</button></div>`, { onClose: v => res(!!v) });
    s.el.querySelector('[data-no]').onclick = () => s.close(false);
    s.el.querySelector('[data-ok]').onclick = () => s.close(true);
  });
}

export function alertBox(title, msg) {
  const s = sheet(`<h3>${esc(title)}</h3><p class="sub">${esc(msg)}</p><div class="row"><button class="btn primary" data-ok autofocus>OK</button></div>`);
  s.el.querySelector('[data-ok]').onclick = () => s.close();
}

export function busy(btn, on, text) {
  if (on) { btn.dataset.t = btn.innerHTML; btn.disabled = true; if (text) btn.textContent = text; }
  else { btn.disabled = false; if (btn.dataset.t) btn.innerHTML = btn.dataset.t; }
}

export { I, esc };
