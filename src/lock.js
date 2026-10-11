// Màn khóa: Android = mã số + vân tay, PC = ô nhập mật khẩu.
// Lần đầu trên điện thoại phải nhập mã; các lần sau mở bằng vân tay.
// Chỉ khóa khi app mở lại từ đầu (đã đóng hoàn toàn), không khóa khi chuyển qua app khác rồi quay lại.
import { I } from './icons.js';
import { LS } from './store.js';
import { isAndroid } from './platform.js';

const DEFAULT_PIN = '0935';

async function sha(s) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('monml:' + s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch { return 'p:' + s; }
}
export async function checkPin(v) {
  const h = LS.get('monml.pin', null);
  return h ? (await sha(v)) === h : v === DEFAULT_PIN;
}
export async function setPin(v) { LS.set('monml.pin', await sha(v)); }

// Lưu ý: KHÔNG trả thẳng plugin Capacitor từ hàm async (proxy của plugin bị coi là "thenable"
// nên await sẽ treo mãi). Bọc trong object { auth }.
async function biometry() {
  if (!isAndroid) return null;
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    const info = await Promise.race([BiometricAuth.checkBiometry(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
    return info.isAvailable ? { auth: BiometricAuth } : null;
  } catch { return null; }
}

export function showLock() {
  return new Promise(resolve => {
    let bio = null;
    const firstTime = !LS.get('monml.verified', false);
    const mobile = isAndroid || (!window.monml && matchMedia('(pointer:coarse)').matches);
    const el = document.createElement('div');
    el.className = 'lock';
    el.innerHTML = `<img class="logo" src="icon.svg" alt=""><h2><span class="m">Mon</span> ML</h2>
      <p class="msg" data-msg></p>
      ${mobile ? `<div class="dots" data-dots>${'<i></i>'.repeat(4)}</div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button class="fp" data-fp aria-label="Mở bằng vân tay" hidden>${I.fp}</button><button data-n="0">0</button><button data-bk aria-label="Xóa">${I.back}</button></div>`
      : `<form class="pw" data-pw autocomplete="off"><input type="password" placeholder="Mật khẩu" aria-label="Mật khẩu" autofocus><button type="button" class="ibtn" data-eye title="Hiện/ẩn mật khẩu">${I.eye}</button><button class="ibtn go" title="Mở khóa (Enter)">${I.r}</button></form>`}
      <span class="credit">Created by Mondiro</span>`;
    document.body.appendChild(el);
    const msg = el.querySelector('[data-msg]');
    msg.textContent = mobile ? (firstTime ? 'Nhập mật khẩu lần đầu' : 'Nhập mật khẩu') : 'Nhập mật khẩu để mở nhật ký';

    const done = () => {
      LS.set('monml.verified', true);
      el.classList.add('out');
      setTimeout(() => el.remove(), 450);
      document.removeEventListener('keydown', onKey);
      resolve();
    };
    const wrong = target => {
      target.classList.remove('shake'); void target.offsetWidth; target.classList.add('shake');
      msg.textContent = 'Sai mật khẩu, thử lại';
      navigator.vibrate?.(80);
    };

    const tryBio = async () => {
      if (!bio) return;
      try {
        await bio.auth.authenticate({ reason: 'Mở nhật ký Mon ML', androidTitle: 'Mon ML', androidSubtitle: 'Chạm vân tay để mở nhật ký', cancelTitle: 'Dùng mật khẩu', allowDeviceCredential: false, androidConfirmationRequired: false });
        done();
      } catch { msg.textContent = 'Nhập mật khẩu hoặc chạm biểu tượng vân tay'; }
    };

    let v = '';
    const dots = el.querySelector('[data-dots]');
    const draw = () => dots?.querySelectorAll('i').forEach((d, i) => d.classList.toggle('f', i < v.length));
    const press = async n => {
      if (v.length >= 4) return;
      v += n; draw();
      if (v.length === 4) {
        const ok = await checkPin(v);
        setTimeout(() => { if (ok) done(); else { wrong(dots); v = ''; draw(); } }, 150);
      }
    };
    const onKey = e => {
      if (!dots) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') { v = v.slice(0, -1); draw(); }
    };
    document.addEventListener('keydown', onKey);
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.n) press(b.dataset.n);
      else if (b.hasAttribute('data-bk')) { v = v.slice(0, -1); draw(); }
      else if (b.hasAttribute('data-fp')) tryBio();
      else if (b.hasAttribute('data-eye')) { const i = el.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; i.focus(); }
    });
    const form = el.querySelector('[data-pw]');
    if (form) {
      const inp = form.querySelector('input');
      setTimeout(() => inp.focus(), 50);
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (await checkPin(inp.value)) done(); else { wrong(form); inp.select(); }
      });
    }
    // Màn khóa đã hiện; giờ mới hỏi cảm biến vân tay
    if (isAndroid && !firstTime) biometry().then(b => {
      if (!b || !el.isConnected) return;
      bio = b;
      el.querySelector('[data-fp]')?.removeAttribute('hidden');
      msg.textContent = 'Chạm cảm biến vân tay để mở';
      setTimeout(tryBio, 250);
    });
  });
}
