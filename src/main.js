import { AppUI } from './ui.js';
import store, { LS, parseFirebaseConfig, authMessage } from './store.js';
import { showLock, checkPin, setPin } from './lock.js';
import { sheet, closeTopSheet, confirmBox, alertBox, busy, esc, I } from './dialogs.js';
import { exportJSON, exportTXT, parseImport, saveFile, stamp } from './io.js';
import { htmlToRich } from './rich.js';
import { initUpdates, checkNow } from './update.js';
import { platform, isAndroid, appVersion } from './platform.js';

let ui;

// ---------- Đồng bộ & tài khoản ----------
function openAccount() {
  const cfg = store.config();
  if (!cfg) {
    const s = sheet(`<h3>${I.cloud.replace('<svg', '<svg style="width:20px;vertical-align:-3px;margin-right:6px"')}Kết nối đồng bộ</h3>
      <p class="sub">Dán đoạn cấu hình máy chủ đồng bộ. Chỉ cần làm 1 lần trên mỗi máy.</p>
      <label class="field">Cấu hình đồng bộ<textarea data-cfg placeholder="{&#10;  apiKey: &quot;…&quot;,&#10;  authDomain: &quot;…&quot;,&#10;  projectId: &quot;…&quot;,&#10;  appId: &quot;…&quot;&#10;};" autofocus></textarea></label>
      <div class="err" data-err></div>
      <div class="row"><button class="btn" data-no>Để sau</button><button class="btn primary" data-ok>Lưu & kết nối</button></div>
      <p class="hint">Chưa kết nối thì nhật ký vẫn lưu trên máy này, kết nối sau sẽ tự đẩy lên.</p>`);
    s.el.querySelector('[data-no]').onclick = () => { LS.set('monml.skipLogin', true); s.close(); };
    s.el.querySelector('[data-ok]').onclick = () => {
      const c = parseFirebaseConfig(s.el.querySelector('[data-cfg]').value);
      if (!c) { s.el.querySelector('[data-err]').textContent = 'Không đọc được config, cần có apiKey, projectId và appId'; return; }
      store.setConfig(c);
      location.reload();
    };
    return;
  }
  if (store.user) {
    const s = sheet(`<h3>Đồng bộ</h3>
      <p class="sub">Đang đăng nhập: <b>${esc(store.user.email || '')}</b><br>Trạng thái: ${esc(ui.$('[data-st]').textContent)}${store.status === 'error' && store.lastError ? `<br><span style="color:var(--red)">${esc(store.lastError)}</span>` : ''}</p>
      <div class="row"><button class="btn" data-out>Đăng xuất</button><button class="btn primary" data-ok autofocus>Xong</button></div>
      <p class="hint">Máy chủ: <code>${esc(cfg.projectId)}</code>${store.configIsBundled() ? '' : ' · <button class="link" data-cfg>Đổi config</button>'}</p>`);
    s.el.querySelector('[data-ok]').onclick = () => s.close();
    s.el.querySelector('[data-out]').onclick = async () => {
      if (await confirmBox('Đăng xuất khỏi tài khoản? Nhật ký vẫn được lưu an toàn trên máy chủ đồng bộ.', 'Đăng xuất')) { await store.logout(); s.close(); }
    };
    s.el.querySelector('[data-cfg]')?.addEventListener('click', resetConfig);
    return;
  }
  const s = sheet(`<h3>Đăng nhập để đồng bộ</h3>
    <p class="sub">Dùng cùng 1 tài khoản trên điện thoại và PC để nhật ký tự đồng bộ.</p>
    <form data-f autocomplete="on">
      <label class="field">Email<input type="email" name="email" autocomplete="username" inputmode="email" autofocus value="${esc(LS.get('monml.email', ''))}"></label>
      <label class="field">Mật khẩu tài khoản<input type="password" name="pw" autocomplete="current-password" minlength="6"></label>
      <div class="err" data-err></div>
      <div class="row"><button type="button" class="btn" data-reg>Tạo tài khoản</button><button class="btn primary" data-in>Đăng nhập</button></div>
    </form>
    <div class="row" style="justify-content:space-between;margin-top:6px"><button class="link" data-forgot>Quên mật khẩu?</button><button class="link" data-skip>Dùng offline trên máy này</button></div>
    ${store.configIsBundled() ? '' : `<p class="hint">Máy chủ: <code>${esc(cfg.projectId)}</code> · <button class="link" data-cfg>Đổi config</button></p>`}`);
  const f = s.el.querySelector('[data-f]'), err = s.el.querySelector('[data-err]');
  const run = async (btn, fn) => {
    err.textContent = '';
    busy(btn, true, 'Đang xử lý…');
    try { LS.set('monml.email', f.email.value.trim()); await fn(f.email.value, f.pw.value); s.close(); ui.toast('Đã đăng nhập, đang đồng bộ…'); }
    catch (e) { err.textContent = authMessage(e); }
    busy(btn, false);
  };
  f.addEventListener('submit', e => { e.preventDefault(); run(s.el.querySelector('[data-in]'), (a, b) => store.login(a, b)); });
  s.el.querySelector('[data-reg]').onclick = e => run(e.currentTarget, (a, b) => store.register(a, b));
  s.el.querySelector('[data-forgot]').onclick = async () => {
    if (!f.email.value.trim()) { err.textContent = 'Nhập email trước'; return; }
    try { await store.resetPassword(f.email.value); err.textContent = ''; ui.toast('Đã gửi email đặt lại mật khẩu'); } catch (e) { err.textContent = authMessage(e); }
  };
  s.el.querySelector('[data-skip]').onclick = () => { LS.set('monml.skipLogin', true); s.close(); };
  s.el.querySelector('[data-cfg]')?.addEventListener('click', resetConfig);
}
async function resetConfig() {
  if (await confirmBox('Xóa cấu hình đồng bộ hiện tại để dán cấu hình khác?', 'Xóa config')) { store.setConfig(null); location.reload(); }
}

// ---------- Nhập dữ liệu ----------
function openImport() {
  const s = sheet(`<h3>Nhập dữ liệu</h3>
    <p class="sub">Chọn file <b>.json</b> (xuất từ Mon Inkdays) hoặc <b>.txt</b>, hoặc dán thẳng văn bản từ Google Docs. Mỗi ngày bắt đầu bằng dòng dạng <b>8/10 t5 …</b></p>
    <div class="row" style="margin-bottom:12px"><button class="btn" data-file>${I.up}Chọn file</button></div>
    <input type="file" accept=".json,.txt,application/json,text/plain" hidden data-input>
    <label class="field">Hoặc dán văn bản (chữ in đậm sẽ hiện dạng **chữ**)<textarea data-text placeholder="ML 2026&#10;4/10 cn đám giỗ má…&#10;5/10 t2 họp team…"></textarea></label>
    <label class="field">Năm của văn bản (nếu văn bản không ghi năm)<input type="number" data-year value="${ui.year}" min="1900" max="2999"></label>
    <div class="err" data-err></div>
    <div class="row"><button class="btn" data-no>Hủy</button><button class="btn primary" data-ok>Xem trước</button></div>`);
  const ta = s.el.querySelector('[data-text]'), inp = s.el.querySelector('[data-input]');
  // Dán từ Google Docs: giữ chữ in đậm dưới dạng **…**
  ta.addEventListener('paste', e => {
    const html = e.clipboardData.getData('text/html');
    if (!html) return;
    e.preventDefault();
    ta.setRangeText(htmlToRich(html), ta.selectionStart, ta.selectionEnd, 'end');
  });
  s.el.querySelector('[data-file]').onclick = () => inp.click();
  inp.onchange = async () => { const f = inp.files[0]; if (f) ta.value = await f.text(); };
  s.el.querySelector('[data-no]').onclick = () => s.close();
  s.el.querySelector('[data-ok]').onclick = async () => {
    const r = parseImport(ta.value, +s.el.querySelector('[data-year]').value || ui.year);
    if (!r.count) { s.el.querySelector('[data-err]').textContent = 'Không tìm thấy ngày nào. Mỗi ngày cần bắt đầu bằng "ngày/tháng", ví dụ 8/10'; return; }
    const ks = Object.keys(r.entries).sort();
    const clash = ks.filter(k => store.get(k)?.text?.trim() && store.get(k).text !== r.entries[k].text).length;
    const ok = await confirmBox(`Nhập ${r.count} ngày (${ks[0].split('-').reverse().join('/')} → ${ks.at(-1).split('-').reverse().join('/')})${clash ? `, trong đó ${clash} ngày sẽ ghi đè nội dung đang có` : ''}?`, 'Nhập');
    if (!ok) return;
    await store.bulk(r.entries);
    s.close();
    ui.toast(`Đã nhập ${r.count} ngày`);
    ui.setYear(+ks.at(-1).slice(0, 4));
  };
}

// ---------- Đổi mật khẩu mở app ----------
function openPin() {
  const s = sheet(`<h3>Đổi mật khẩu mở app</h3>
    <p class="sub">Mật khẩu này dùng để mở khóa Mon Inkdays trên máy này. ${isAndroid ? 'Điện thoại dùng mã 4 số.' : ''}</p>
    <form data-f>
      <label class="field">Mật khẩu hiện tại<input type="password" name="cur" inputmode="${isAndroid ? 'numeric' : 'text'}" autofocus></label>
      <label class="field">Mật khẩu mới<input type="password" name="n1" inputmode="${isAndroid ? 'numeric' : 'text'}"></label>
      <label class="field">Nhập lại mật khẩu mới<input type="password" name="n2" inputmode="${isAndroid ? 'numeric' : 'text'}"></label>
      <div class="err" data-err></div>
      <div class="row"><button type="button" class="btn" data-no>Hủy</button><button class="btn primary">Lưu</button></div>
    </form>`);
  const f = s.el.querySelector('[data-f]'), err = s.el.querySelector('[data-err]');
  s.el.querySelector('[data-no]').onclick = () => s.close();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (!(await checkPin(f.cur.value))) { err.textContent = 'Mật khẩu hiện tại không đúng'; return; }
    if (isAndroid && !/^\d{4}$/.test(f.n1.value)) { err.textContent = 'Trên điện thoại, mật khẩu là 4 chữ số'; return; }
    if (f.n1.value.length < 4) { err.textContent = 'Mật khẩu cần ít nhất 4 ký tự'; return; }
    if (f.n1.value !== f.n2.value) { err.textContent = 'Hai lần nhập không khớp'; return; }
    await setPin(f.n1.value);
    s.close(); ui.toast('Đã đổi mật khẩu');
  });
}

// ---------- Menu ----------
async function openMenu(u) {
  const ver = await appVersion().catch(() => '');
  u.showMenu([
    { id: 'today', icon: I.today, label: 'Về hôm nay', run: () => u.jumpNow() },
    '-',
    { id: 'exp', icon: I.down, label: 'Xuất toàn bộ dữ liệu (.json)', run: async () => { if (await saveFile(`MonML-backup-${stamp()}.json`, exportJSON(), 'application/json')) u.toast('Đã xuất dữ liệu'); } },
    { id: 'txt', icon: I.doc, label: `Xuất văn bản năm ${u.year} (.txt)`, run: async () => { if (await saveFile(`ML ${u.year}.txt`, exportTXT(u.year, u.daysOfYear()))) u.toast('Đã xuất văn bản'); } },
    { id: 'imp', icon: I.up, label: 'Nhập dữ liệu / dán từ Google Docs', run: openImport },
    '-',
    { id: 'sync', icon: I.cloud, label: store.user ? 'Đồng bộ · ' + (store.user.email || '') : 'Đồng bộ & tài khoản', run: openAccount },
    { id: 'pin', icon: I.key, label: 'Đổi mật khẩu mở app', run: openPin },
    { id: 'lock', icon: I.lock, label: 'Khóa ngay', run: lockNow },
    { note: `Mon Inkdays v${ver} · Created by Mondiro` },
  ]);
}

async function lockNow() {
  ui.commitEdit();
  store.flush();
  ui.root.classList.add('locked');
  await showLock();
  ui.root.classList.remove('locked');
}

// ---------- Khởi động ----------
async function boot() {
  document.documentElement.dataset.platform = platform;
  if (platform === 'desktop') document.documentElement.classList.add('electron');
  ui = new AppUI(document.getElementById('root'), { platform, onMenu: openMenu, onSync: openAccount, onUpdate: () => checkNow(ui) });
  if (isAndroid) {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
      if (document.querySelector('.lock')) { App.minimizeApp(); return; }
      if (closeTopSheet() || ui.back()) return;
      App.minimizeApp(); // không thoát hẳn, để lần sau mở lại không phải mở khóa
    });
  }
  const storeReady = store.init().catch(e => store.fail(e));
  await showLock();
  await storeReady;
  ui.root.classList.remove('locked');
  ui.refresh();
  ui.jumpNow();
  if (store.status === 'signedout' && !LS.get('monml.skipLogin', false)) openAccount();
  if (store.status === 'local' && !LS.get('monml.skipLogin', false)) setTimeout(openAccount, 300);
  initUpdates(ui);
  window.addEventListener('error', e => console.error(e.error || e.message));
}

boot().catch(e => { console.error(e); alertBox('Lỗi khởi động', String(e?.message || e)); });
