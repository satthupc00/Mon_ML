import { I } from './icons.js';
import { label, addDay, keyOf, pad2, todayKey, parseK } from './dates.js';
import store from './store.js';
import { confirmBox } from './dialogs.js';

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// So khớp không phân biệt hoa thường (giữ dấu tiếng Việt)
const norm = s => s.toLowerCase();

const STATUS = {
  local: 'Chưa đồng bộ · lưu trên máy',
  signedout: 'Chưa đăng nhập · bấm để đồng bộ',
  syncing: 'Đang đồng bộ…',
  synced: 'Đã đồng bộ',
  offline: 'Offline · sẽ đồng bộ khi có mạng',
  error: 'Lỗi đồng bộ · bấm để xem',
};

export class AppUI {
  constructor(root, { platform, onMenu, onSync }) {
    this.platform = platform;
    this.onMenu = onMenu;
    this.onSync = onSync;
    this.mode = 'flow';
    this.year = new Date().getFullYear();
    this.q = '';
    this.open = null;
    this.extra = new Set(); // ngày vừa thêm bằng nút + nhưng chưa viết gì
    root.innerHTML = `<div class="app locked ${platform === 'desktop' ? 'desk' : ''}" data-mode="flow">
      <header class="top">
        <div class="brand"><img src="icon.svg" alt=""><div style="min-width:0"><div class="brand-name"><span class="m">Mon</span> <span class="a">ML</span></div><div class="brand-desc">Nhật kí</div></div></div>
        <label class="searchbar only-desk" title="Tìm kiếm (Ctrl+F)">${I.search}<input placeholder="Tìm từ khóa…" data-q enterkeyhint="search"><span class="cnt" data-cnt></span></label>
        <div class="year"><button class="ibtn" data-y="-1" title="Năm trước" aria-label="Năm trước">${I.l}</button><b data-yl></b><button class="ibtn" data-y="1" title="Năm sau" aria-label="Năm sau">${I.r}</button></div>
        <button class="ibtn only-mob" data-act="search" title="Tìm kiếm" aria-label="Tìm kiếm">${I.search}</button>
        <button class="ibtn" data-act="menu" title="Thêm" aria-label="Menu">${I.more}</button>
      </header>
      <div data-banner></div>
      <div class="subbar">
        <label class="searchbar">${I.search}<input placeholder="Tìm từ khóa…" data-q enterkeyhint="search"><span class="cnt" data-cnt></span><button class="x" data-act="clearq" aria-label="Xóa tìm kiếm">${I.x}</button></label>
        <div class="seg"><span class="pill"></span><button data-m="flow" class="on">${I.flow}Dòng chảy</button><button data-m="cal">${I.cal}Lịch</button></div>
      </div>
      <div class="views"><div class="track">
        <div class="pane flowp"><div class="flow" data-flow></div></div>
        <div class="pane calp"><div class="cal" data-cal></div></div>
      </div><button class="tobottom" data-act="bottom" title="Xuống cuối" aria-label="Xuống cuối">${I.chev}</button></div>
      <footer class="foot"><button class="sync" data-act="sync"><i></i><span data-st></span></button><span class="credit">Created by Mondiro</span></footer>
    </div>`;
    this.root = root.firstElementChild;
    this.flowEl = this.$('[data-flow]');
    this.calEl = this.$('[data-cal]');
    this.flowP = this.$('.flowp');
    this.calP = this.$('.calp');
    new ResizeObserver(() => { this.checkWide(); this.checkBottom(); }).observe(this.root);
    this.flowP.addEventListener('scroll', () => this.checkBottom(), { passive: true });
    this.checkWide();
    this.bind();
    store.on(ev => this.onStore(ev));
    this.refresh();
    this.showStatus();
  }

  $(s) { return this.root.querySelector(s); }
  $$(s) { return this.root.querySelectorAll(s); }
  get wide() { return this.root.classList.contains('wide'); }
  checkWide() { this.root.classList.toggle('wide', this.root.clientWidth >= 600); }

  // ----- Dữ liệu theo năm -----
  keysOfYear() {
    const p = this.year + '-';
    return [...new Set([...store.keys(), ...this.extra])].filter(k => k.startsWith(p)).sort();
  }
  // Mọi ngày từ ngày viết đầu tiên tới hôm nay (năm cũ: tới 31/12). Ngày chưa viết vẫn hiện nhãn.
  daysOfYear() {
    const ks = this.keysOfYear(), today = todayKey(), ty = +today.slice(0, 4);
    let a = ks[0], b = ks.at(-1);
    if (this.year === ty) { a = a && a < today ? a : today; b = b && b > today ? b : today; }
    else if (this.year < ty && a) b = `${this.year}-12-31`;
    if (!a) return [];
    const out = [];
    for (let k = a; k <= b; k = addDay(k, 1)) out.push(k);
    return out;
  }
  match(k) {
    const q = norm(this.q.trim()), e = store.get(k);
    return !!(q && e && norm(e.text).includes(q));
  }
  hl(t) {
    const q = this.q.trim();
    if (!q) return esc(t);
    return esc(t).replace(new RegExp('(' + reEsc(esc(q)) + ')', 'gi'), '<mark>$1</mark>');
  }

  // ----- Vẽ -----
  refresh(focusKey) {
    const s1 = this.flowP.scrollTop, s2 = this.calP.scrollTop;
    this.$('[data-yl]').textContent = this.year;
    this.renderFlow();
    this.renderCal();
    this.flowP.scrollTop = s1; this.calP.scrollTop = s2;
    this.updateCount();
    this.checkBottom();
    this.pendingRebuild = false;
    if (focusKey) this.focusEntry(focusKey, true);
  }
  // Nút mũi tên xuống cuối: hiện khi đang ở các dòng phía trên
  checkBottom() {
    const p = this.flowP;
    const far = p.scrollHeight - p.scrollTop - p.clientHeight > 240;
    this.$('.tobottom').classList.toggle('show', far);
  }
  updateCount() {
    const n = this.q.trim() ? this.daysOfYear().filter(k => this.match(k)).length : 0;
    this.$$('[data-cnt]').forEach(c => { c.textContent = this.q.trim() ? n + ' ngày' : ''; });
  }
  entHTML(k) {
    const e = store.get(k) || { text: '', mood: null };
    return `<p class="${this.entCls(k)}" data-k="${k}"><span class="date" data-open="${k}" title="Gán tag màu">${label(k)}</span><span class="txt" contenteditable="plaintext-only" spellcheck="false" data-k="${k}">${this.hl(e.text)}</span><span class="acts">${this.actsHTML(k)}</span></p>`;
  }
  entCls(k) {
    const e = store.get(k);
    const wd = parseK(k).getDay();
    return ['ent', wd === 6 ? 'sat' : wd === 0 ? 'sun' : '', e?.mood || '', e?.text.trim() ? '' : 'empty', this.open === k ? 'open' : ''].filter(Boolean).join(' ');
  }
  actsHTML(k) {
    const m = store.get(k)?.mood;
    return `<button class="mood pos ${m === 'pos' ? 'on' : ''}" data-mood="pos" data-k="${k}" title="Tích cực" aria-label="Tích cực"></button><button class="mood neg ${m === 'neg' ? 'on' : ''}" data-mood="neg" data-k="${k}" title="Tiêu cực" aria-label="Tiêu cực"></button><span class="sep"></span><button class="tgl" data-del="${k}">${I.trash}Xóa nội dung</button>`;
  }
  renderFlow() {
    const ds = this.daysOfYear();
    let h = `<div class="flow-paper"><p class="ym">ML ${this.year}</p>`;
    if (!ds.length) h += `<p class="empty-year">Năm ${this.year} chưa có trang nào. Bấm nút bên dưới để bắt đầu viết.</p>`;
    for (const k of ds) h += this.entHTML(k);
    const next = ds.length ? addDay(ds.at(-1), 1) : (this.year === new Date().getFullYear() ? todayKey() : `${this.year}-01-01`);
    this.nextKey = next;
    h += `<button class="add" data-add title="Thêm ngày tiếp theo (Ctrl+Enter)"><span class="plus">${I.plus}</span>Thêm <span class="nd">${label(next)}</span></button></div>`;
    this.flowEl.innerHTML = h;
  }
  cellCls(k) {
    const e = store.get(k);
    return ['cell', e?.text.trim() ? 'has' : '', e?.mood || '', this.match(k) ? 'hit' : '', k === todayKey() ? 'today' : '', k === this.open ? 'sel' : ''].filter(Boolean).join(' ');
  }
  renderCal() {
    let h = '';
    for (let m = 0; m < 12; m++) {
      const first = new Date(this.year, m, 1), days = new Date(this.year, m + 1, 0).getDate(), off = (first.getDay() + 6) % 7;
      let cnt = 0, cells = '<div class="cell blank"></div>'.repeat(off);
      for (let d = 1; d <= days; d++) {
        const k = `${this.year}-${pad2(m + 1)}-${pad2(d)}`;
        if (store.get(k)?.text.trim()) cnt++;
        cells += `<button class="${this.cellCls(k)}" data-day="${k}" title="${label(k)}">${d}</button>`;
      }
      h += `<div class="mhead" data-month="${m}"><h4>Tháng ${m + 1}</h4><span>${cnt ? cnt + ' ngày đã viết' : ''}</span></div><div class="month"><div class="wk">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(x => `<div>${x}</div>`).join('')}</div><div class="grid">${cells}</div></div>`;
    }
    this.calEl.innerHTML = h;
  }
  patchCells(keys) {
    for (const k of keys) { const c = this.calEl.querySelector(`.cell[data-day="${k}"]`); if (c) c.className = this.cellCls(k); }
  }
  patchEntry(k) {
    const el = this.flowEl.querySelector(`.ent[data-k="${k}"]`);
    if (!el) return false;
    el.className = this.entCls(k);
    const t = el.querySelector('.txt');
    if (document.activeElement !== t) t.innerHTML = this.hl(store.get(k)?.text || '');
    el.querySelector('.acts').innerHTML = this.actsHTML(k);
    return true;
  }

  onStore(ev) {
    if (ev.type === 'status') return this.showStatus();
    if (ev.type === 'reset') return this.refresh();
    const editing = document.activeElement?.classList?.contains('txt') && this.flowEl.contains(document.activeElement);
    if (ev.origin === 'type') { this.patchCells(ev.keys); this.updateCount(); return; }
    if (!editing) return this.refresh();
    // Đang gõ: chỉ vá từng dòng, phần còn lại vẽ lại khi rời ô
    for (const k of ev.keys) if (!this.patchEntry(k) && k.startsWith(this.year + '-')) this.pendingRebuild = true;
    this.patchCells(ev.keys);
    this.updateCount();
  }
  showStatus() {
    const s = this.$('.sync');
    s.className = 'sync ' + store.status;
    this.$('[data-st]').textContent = STATUS[store.status] || '';
  }

  // ----- Điều hướng -----
  setMode(m) {
    this.mode = m;
    this.root.dataset.mode = m;
    this.$$('.seg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  }
  setYear(y) {
    this.year = y; this.open = null; this.refresh();
    this.flowP.scrollTop = this.flowP.scrollHeight;
    this.scrollCalTo(y === new Date().getFullYear() ? new Date().getMonth() : 0);
  }
  scrollCalTo(m) {
    const h = this.calEl.querySelector(`.mhead[data-month="${m}"]`);
    if (h) this.calP.scrollTop += h.getBoundingClientRect().top - this.calP.getBoundingClientRect().top;
  }
  jumpNow() {
    if (this.year !== new Date().getFullYear()) { this.setYear(new Date().getFullYear()); return; }
    this.flowP.scrollTop = this.flowP.scrollHeight;
    this.scrollCalTo(new Date().getMonth());
  }
  focusEntry(k, caret) {
    const e = this.flowEl.querySelector(`.ent[data-k="${k}"]`);
    if (!e) return;
    e.scrollIntoView({ block: 'center', behavior: 'smooth' });
    e.classList.add(caret ? 'pop' : 'flash');
    setTimeout(() => e.classList.remove('pop', 'flash'), 1500);
    if (caret) {
      const t = e.querySelector('.txt');
      setTimeout(() => { t.focus({ preventScroll: true }); placeEnd(t); }, 320);
    }
  }
  openDay(k) {
    if (+k.slice(0, 4) !== this.year) this.year = +k.slice(0, 4);
    if (!this.daysOfYear().includes(k)) this.extra.add(k);
    this.open = k;
    if (!this.wide) this.setMode('flow');
    this.refresh();
    setTimeout(() => this.focusEntry(k, !store.get(k)?.text.trim()), this.wide ? 20 : 380);
  }
  setQuery(v) {
    this.q = v;
    this.$$('[data-q]').forEach(i => { if (i.value !== v) i.value = v; });
    this.refresh();
  }
  toggleSearch(force) {
    const on = force ?? !this.root.classList.contains('searching');
    this.root.classList.toggle('searching', on);
    this.$('[data-act=search]').classList.toggle('on', on);
    if (on) setTimeout(() => this.$('.subbar [data-q]').focus(), 50);
    else if (this.q) this.setQuery('');
  }
  closeMenu() { const m = this.$('.menu'); if (m) { m.remove(); return true; } return false; }
  toast(t) {
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = t;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2700);
  }
  banner(html) { this.$('[data-banner]').innerHTML = html ? `<div class="banner">${html}</div>` : ''; return this.$('[data-banner] .banner'); }

  // Nút Back của Android: đóng lớp trên cùng, trả về false nếu không còn gì để đóng
  back() {
    if (this.closeMenu()) return true;
    if (this.open) { this.open = null; this.refresh(); return true; }
    if (this.root.classList.contains('searching')) { this.toggleSearch(false); return true; }
    if (!this.wide && this.mode === 'cal') { this.setMode('flow'); return true; }
    return false;
  }

  bind() {
    const R = this.root;
    R.addEventListener('click', ev => {
      const b = ev.target.closest('button,[data-open]');
      if (!ev.target.closest('.menu')) this.closeMenu();
      if (!b) return;
      const d = b.dataset;
      if (d.m) this.setMode(d.m);
      else if (d.y) this.setYear(this.year + +d.y);
      else if (d.open) { this.open = this.open === d.open ? null : d.open; this.refresh(); }
      else if (d.mood) { const cur = store.get(d.k)?.mood; store.set(d.k, { mood: cur === d.mood ? null : d.mood }); }
      else if (d.del) { const k = d.del; confirmBox(`Xóa nội dung ngày ${label(k)}?`, 'Xóa').then(ok => { if (ok) { this.open = null; store.set(k, { text: '', mood: null }); } }); }
      else if (b.hasAttribute('data-add')) { const k = this.nextKey; this.extra.add(k); this.open = null; this.refresh(k); }
      else if (d.day) this.openDay(d.day);
      else if (d.act === 'search') this.toggleSearch();
      else if (d.act === 'clearq') { this.setQuery(''); this.$('.subbar [data-q]').focus(); }
      else if (d.act === 'menu') { if (!this.closeMenu()) this.onMenu(this); }
      else if (d.act === 'sync') this.onSync();
      else if (d.act === 'bottom') this.flowP.scrollTo({ top: this.flowP.scrollHeight, behavior: 'smooth' });
    });
    R.addEventListener('input', ev => {
      const t = ev.target;
      if (t.dataset.q !== undefined) { this.setQuery(t.value); return; }
      if (t.classList.contains('txt')) {
        const k = t.dataset.k;
        const text = t.innerText.replace(/\n$/, '');
        t.closest('.ent').classList.toggle('empty', !text.trim());
        store.set(k, { text }, 'type');
      }
    });
    R.addEventListener('focusout', ev => {
      if (ev.target.classList?.contains('txt') && this.pendingRebuild) setTimeout(() => {
        if (!document.activeElement?.classList?.contains('txt')) this.refresh();
      }, 0);
    });
    R.addEventListener('keydown', ev => {
      if (ev.target.classList?.contains('txt') && ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault(); this.$('[data-add]').click();
      }
    });
    document.addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'f') {
        ev.preventDefault();
        const i = this.$('.app.desk.wide .searchbar.only-desk input') || (this.toggleSearch(true), null);
        i?.focus(); i?.select();
      } else if (ev.key === 'Escape') {
        if (!this.closeMenu() && this.q) this.setQuery('');
      }
    });
    // Vuốt mạnh trái/phải để đổi Dòng chảy ⇄ Lịch (màn hẹp)
    const v = this.$('.views');
    let sx = null, sy, st;
    v.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; st = performance.now(); });
    v.addEventListener('pointercancel', () => { sx = null; });
    v.addEventListener('pointerup', e => {
      if (this.wide || sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy, dt = performance.now() - st;
      sx = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && Math.abs(dx) / dt > 0.35 && !getSelection().toString())
        this.setMode(dx < 0 ? 'cal' : 'flow');
    });
    // pointerup không tới khi trình duyệt cuộn ngang: dùng touch làm dự phòng
    let tx = null, ty, tt;
    v.addEventListener('touchstart', e => { const p = e.touches[0]; tx = p.clientX; ty = p.clientY; tt = performance.now(); }, { passive: true });
    v.addEventListener('touchend', e => {
      if (this.wide || tx == null) return;
      const p = e.changedTouches[0], dx = p.clientX - tx, dy = p.clientY - ty, dt = performance.now() - tt;
      tx = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && Math.abs(dx) / dt > 0.35 && !getSelection().toString())
        this.setMode(dx < 0 ? 'cal' : 'flow');
    });
  }

  showMenu(items) {
    const m = document.createElement('div');
    m.className = 'menu';
    m.innerHTML = items.map(it => it === '-' ? '<hr>' : it.note ? `<div class="ver">${esc(it.note)}</div>` : `<button data-mi="${it.id}">${it.icon}${esc(it.label)}</button>`).join('');
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-mi]');
      if (!b) return;
      m.remove();
      items.find(x => x.id === b.dataset.mi)?.run();
    });
    this.root.appendChild(m);
  }
}

export function placeEnd(el) {
  const r = document.createRange();
  r.selectNodeContents(el); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
export { keyOf };
