import { I } from './icons.js';
import { label, addDay, keyOf, pad2, todayKey, parseK } from './dates.js';
import store from './store.js';
import { confirmBox } from './dialogs.js';
import { plain, toHTML, fromDOM, htmlToRich } from './rich.js';

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
        <div class="brand"><img src="icon.svg" alt=""><div style="min-width:0"><div class="brand-name"><span class="m">Mon</span> <span class="a">Inkdays</span></div><div class="brand-desc">Nhật kí</div></div></div>
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
      </div><div class="fscroll"><div class="thumb"></div><div class="bubble"></div></div><button class="tobottom" data-act="bottom" title="Xuống cuối" aria-label="Xuống cuối">${I.chev}</button>
      <button class="quick" data-act="quick" title="Nhảy tới hôm nay và viết luôn">${I.plus}Nhập nhanh</button>
      <div class="editbar"><button data-act="bold" title="In đậm (Ctrl+B)" aria-label="In đậm"><b>B</b></button><button data-act="done" class="done" title="Xong, lưu và đồng bộ (Esc)" aria-label="Xong">${I.check}</button></div></div>
      <footer class="foot"><button class="sync" data-act="sync"><i></i><span data-st></span></button><span class="credit">Created by Mondiro</span></footer>
    </div>`;
    this.root = root.firstElementChild;
    this.flowEl = this.$('[data-flow]');
    this.calEl = this.$('[data-cal]');
    this.flowP = this.$('.flowp');
    this.calP = this.$('.calp');
    new ResizeObserver(() => { this.checkWide(); this.checkBottom(); this.syncScrollbar(false); }).observe(this.root);
    this.flowP.addEventListener('scroll', () => { this.checkBottom(); this.syncScrollbar(true); }, { passive: true });
    // Bộ lọc SVG tạo hiệu ứng "giọt nước" cho các ô du lịch liền nhau trên lịch
    if (!document.getElementById('monml-goo')) document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="monml-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="g"/><feComposite in="SourceGraphic" in2="g" operator="atop"/></filter></svg>');
    this.bindScrollbar();
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
    return !!(q && e && norm(plain(e.text)).includes(q));
  }
  hlPlain(t) {
    const q = this.q.trim();
    if (!q) return esc(t);
    return esc(t).replace(new RegExp('(' + reEsc(esc(q)) + ')', 'gi'), '<mark>$1</mark>');
  }
  hl(t) { return toHTML(t, s => this.hlPlain(s)); }

  // ----- Vẽ -----
  refresh(focusKey) {
    const s1 = this.flowP.scrollTop, s2 = this.calP.scrollTop;
    // Đang gõ mà phải vẽ lại: lưu chữ + vị trí con trỏ rồi mở lại đúng chỗ (tránh mất dấu nháy)
    const ek = this.editing;
    let caret = null;
    if (ek) {
      const t = this.flowEl.querySelector(`.ent[data-k="${ek}"] .txt`);
      if (t) { caret = caretOffset(t); store.set(ek, { text: fromDOM(t) }, 'type'); }
      this.editing = null;
    }
    this.$('[data-yl]').textContent = this.year;
    this.renderFlow();
    this.renderCal();
    this.flowP.scrollTop = s1; this.calP.scrollTop = s2;
    this.updateCount();
    this.checkBottom();
    this.syncScrollbar(false);
    this.pendingRebuild = false;
    if (ek && this.flowEl.querySelector(`.ent[data-k="${ek}"]`)) this.startEdit(ek, null, null, caret);
    else if (ek) this.root.classList.remove('editmode');
    if (focusKey) this.focusEntry(focusKey, true);
  }
  // Nút mũi tên xuống cuối: hiện khi đang ở các dòng phía trên
  checkBottom() {
    const p = this.flowP;
    const far = p.scrollHeight - p.scrollTop - p.clientHeight > 240;
    this.$('.tobottom').classList.toggle('show', far);
  }
  // ----- Thanh cuộn bên phải của Dòng chảy (giữ kéo để cuộn nhanh) -----
  syncScrollbar(show) {
    const p = this.flowP, bar = this.$('.fscroll'), th = bar.firstElementChild;
    const track = bar.clientHeight, ratio = p.clientHeight / Math.max(1, p.scrollHeight);
    if (ratio >= 0.98) { bar.classList.remove('show'); return; }
    const h = Math.max(44, track * ratio), max = p.scrollHeight - p.clientHeight;
    th.style.height = h + 'px';
    th.style.top = ((track - h) * (p.scrollTop / Math.max(1, max))) + 'px';
    if (show) {
      bar.classList.add('show');
      clearTimeout(this._sbT);
      this._sbT = setTimeout(() => { if (!bar.classList.contains('drag')) bar.classList.remove('show'); }, 1300);
    }
  }
  bindScrollbar() {
    const bar = this.$('.fscroll'), th = bar.firstElementChild, bub = bar.lastElementChild, p = this.flowP;
    let startY = 0, startTop = 0;
    const dayAt = () => {
      const ents = this.flowEl.querySelectorAll('.ent');
      const y = p.scrollTop + 40;
      let lo = 0, hi = ents.length - 1, best = ents[0];
      while (lo <= hi) { const m = (lo + hi) >> 1; if (ents[m].offsetTop <= y) { best = ents[m]; lo = m + 1; } else hi = m - 1; }
      return best ? label(best.dataset.k) : '';
    };
    th.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      th.setPointerCapture(e.pointerId);
      startY = e.clientY; startTop = parseFloat(th.style.top) || 0;
      bar.classList.add('drag', 'show');
      bub.textContent = dayAt(); bub.style.top = (startTop + th.offsetHeight / 2) + 'px';
    });
    th.addEventListener('pointermove', e => {
      if (!bar.classList.contains('drag')) return;
      const track = bar.clientHeight - th.offsetHeight;
      const top = Math.min(track, Math.max(0, startTop + e.clientY - startY));
      p.scrollTop = (top / Math.max(1, track)) * (p.scrollHeight - p.clientHeight);
      bub.textContent = dayAt(); bub.style.top = (top + th.offsetHeight / 2) + 'px';
    });
    const end = () => { bar.classList.remove('drag'); this.syncScrollbar(true); };
    th.addEventListener('pointerup', end);
    th.addEventListener('pointercancel', end);
  }
  updateCount() {
    const n = this.q.trim() ? this.daysOfYear().filter(k => this.match(k)).length : 0;
    this.$$('[data-cnt]').forEach(c => { c.textContent = this.q.trim() ? n + ' ngày' : ''; });
  }
  entHTML(k) {
    const e = store.get(k) || { text: '', mood: null };
    return `<p class="${this.entCls(k)}" data-k="${k}"><span class="date" data-open="${k}" title="Gán tag màu">${label(k)}</span><span class="txt" spellcheck="false" data-k="${k}">${this.hl(e.text)}</span><span class="acts">${this.actsHTML(k)}</span></p>`;
  }
  entCls(k) {
    const e = store.get(k);
    const wd = parseK(k).getDay();
    return ['ent', wd === 6 ? 'sat' : wd === 0 ? 'sun' : '', e?.mood || '', plain(e?.text).trim() ? '' : 'empty', this.open === k ? 'open' : '', this.editing === k ? 'editing' : ''].filter(Boolean).join(' ');
  }
  actsHTML(k) {
    const m = store.get(k)?.mood;
    return `<button class="mood pos ${m === 'pos' ? 'on' : ''}" data-mood="pos" data-k="${k}" title="Tích cực" aria-label="Tích cực"></button><button class="mood neg ${m === 'neg' ? 'on' : ''}" data-mood="neg" data-k="${k}" title="Tiêu cực" aria-label="Tiêu cực"></button><button class="mood trip ${m === 'trip' ? 'on' : ''}" data-mood="trip" data-k="${k}" title="Đi du lịch" aria-label="Đi du lịch"></button><span class="sep"></span><button class="tgl" data-del="${k}">${I.trash}Xóa nội dung</button>`;
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
    return ['cell', plain(e?.text).trim() ? 'has' : '', e?.mood || '', this.match(k) ? 'hit' : '', k === todayKey() ? 'today' : '', k === this.open ? 'sel' : ''].filter(Boolean).join(' ');
  }
  renderCal() {
    let h = '';
    for (let m = 0; m < 12; m++) {
      const first = new Date(this.year, m, 1), days = new Date(this.year, m + 1, 0).getDate(), off = (first.getDay() + 6) % 7;
      let cnt = 0, cells = '<div class="cell blank"></div>'.repeat(off), goo = '<i></i>'.repeat(off);
      for (let d = 1; d <= days; d++) {
        const k = `${this.year}-${pad2(m + 1)}-${pad2(d)}`;
        if (plain(store.get(k)?.text).trim()) cnt++;
        cells += `<button class="${this.cellCls(k)}" data-day="${k}" title="${label(k)}">${d}</button>`;
        goo += store.get(k)?.mood === 'trip' ? '<i class="b"></i>' : '<i></i>';
      }
      h += `<div class="mhead" data-month="${m}"><h4>Tháng ${m + 1}</h4><span>${cnt ? cnt + ' ngày đã viết' : ''}</span></div><div class="month"><div class="wk">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(x => `<div>${x}</div>`).join('')}</div><div class="gwrap">${goo.includes('"b"') ? `<div class="goo">${goo}</div>` : ''}<div class="grid">${cells}</div></div></div>`;
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
    if (this.editing !== k) t.innerHTML = this.hl(store.get(k)?.text || '');
    el.querySelector('.acts').innerHTML = this.actsHTML(k);
    return true;
  }

  onStore(ev) {
    if (ev.type === 'status') return this.showStatus();
    if (ev.type === 'reset') return this.refresh();
    if (ev.origin === 'type') { this.patchCells(ev.keys); this.updateCount(); return; }
    if (!this.editing) return this.refresh();
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
  // Vuốt mạnh: luôn chuyển sang chế độ còn lại, trang mới trượt vào theo hướng vuốt
  swipe(dir) {
    const now = performance.now();
    if (now - (this._swAt || 0) < 350) return;
    this._swAt = now;
    if (this.editing) this.commitEdit();
    const next = this.mode === 'flow' ? 'cal' : 'flow';
    const tr = this.$('.track');
    tr.style.transition = 'none';
    this.setMode(next);
    void tr.offsetWidth;
    tr.style.transition = '';
    const pane = this.$(next === 'flow' ? '.flowp' : '.calp');
    pane.classList.remove('in-l', 'in-r'); void pane.offsetWidth;
    pane.classList.add(dir < 0 ? 'in-r' : 'in-l');
    setTimeout(() => pane.classList.remove('in-l', 'in-r'), 500);
  }
  setMode(m) {
    this.mode = m;
    this.root.dataset.mode = m;
    this.$$('.seg button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  }
  setYear(y, animate) {
    if (this.editing) this.commitEdit();
    const dir = y > this.year ? 1 : -1;
    const go = () => {
      this.year = y; this.open = null; this.refresh();
      this.flowP.scrollTop = this.flowP.scrollHeight;
      this.scrollCalTo(y === new Date().getFullYear() ? new Date().getMonth() : 0);
    };
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return go();
    const els = [this.flowEl, this.calEl];
    els.forEach(e => { e.classList.remove('yr-in-l', 'yr-in-r'); e.classList.add(dir > 0 ? 'yr-out-l' : 'yr-out-r'); });
    clearTimeout(this._yrT);
    this._yrT = setTimeout(() => {
      go();
      els.forEach(e => { e.classList.remove('yr-out-l', 'yr-out-r'); void e.offsetWidth; e.classList.add(dir > 0 ? 'yr-in-r' : 'yr-in-l'); });
      setTimeout(() => els.forEach(e => e.classList.remove('yr-in-l', 'yr-in-r')), 450);
    }, 170);
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
  focusEntry(k, edit) {
    const e = this.flowEl.querySelector(`.ent[data-k="${k}"]`);
    if (!e) return;
    e.scrollIntoView({ block: 'center', behavior: 'smooth' });
    e.classList.add(edit ? 'pop' : 'flash');
    setTimeout(() => e.classList.remove('pop', 'flash'), 1500);
    if (edit) setTimeout(() => this.startEdit(k), 320);
  }

  // ----- Chế độ gõ: chạm 2 lần vào 1 ngày để gõ, bấm ✓ để xong và đồng bộ -----
  startEdit(k, x, y, caretAt) {
    if (this.editing === k) return;
    if (this.editing) this.commitEdit();
    const ent = this.flowEl.querySelector(`.ent[data-k="${k}"]`);
    if (!ent) return;
    const t = ent.querySelector('.txt');
    this.editing = k;
    this.open = null;
    ent.className = this.entCls(k);
    t.innerHTML = toHTML(store.get(k)?.text || '', esc);
    t.contentEditable = 'true';
    this.root.classList.add('editmode');
    t.focus({ preventScroll: true });
    const r = x != null && document.caretRangeFromPoint?.(x, y);
    if (r && t.contains(r.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    else if (caretAt != null) setCaret(t, caretAt);
    else placeEnd(t);
    this.savedRange = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : null;
    this.updateBold();
  }
  commitEdit() {
    const k = this.editing;
    if (!k) return;
    const t = this.flowEl.querySelector(`.ent[data-k="${k}"] .txt`);
    this.editing = null;
    this.savedRange = null;
    this.root.classList.remove('editmode');
    if (t) { const text = fromDOM(t); t.contentEditable = 'false'; t.blur(); store.set(k, { text }); }
    else this.refresh();
    store.flush();
  }
  restoreSel() {
    const t = this.$('.ent.editing .txt');
    if (!t) return;
    if (document.activeElement !== t) t.focus({ preventScroll: true });
    if (this.savedRange && t.contains(this.savedRange.startContainer)) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(this.savedRange); }
  }
  updateBold() {
    let on = false;
    try { on = !!this.editing && document.queryCommandState('bold'); } catch { /* bỏ qua */ }
    this.$('[data-act=bold]').classList.toggle('on', on);
  }
  openDay(k) {
    if (+k.slice(0, 4) !== this.year) this.year = +k.slice(0, 4);
    if (!this.daysOfYear().includes(k)) this.extra.add(k);
    this.open = k;
    if (!this.wide) this.setMode('flow');
    this.refresh();
    setTimeout(() => this.focusEntry(k, !plain(store.get(k)?.text).trim()), this.wide ? 20 : 380);
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
    if (this.editing) { this.commitEdit(); return true; }
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
      if (this.open && !ev.target.closest('.acts,.date')) { this.open = null; const o = this.flowEl.querySelector('.ent.open'); o?.classList.remove('open'); }
      if (!b) return;
      const d = b.dataset;
      if (d.m) this.setMode(d.m);
      else if (d.y) this.setYear(this.year + +d.y, true);
      else if (d.open) this.toggleTags(d.open);
      else if (d.mood) { const k = d.k, cur = store.get(k)?.mood; b.classList.toggle('on', cur !== d.mood); setTimeout(() => { this.open = null; this.flowEl.querySelector('.ent.open')?.classList.remove('open'); store.set(k, { mood: cur === d.mood ? null : d.mood }); if (this.editing) this.restoreSel(); }, 220); }
      else if (d.del) { const k = d.del; confirmBox(`Xóa nội dung ngày ${label(k)}?`, 'Xóa').then(ok => { if (ok) { this.open = null; store.set(k, { text: '', mood: null }); } }); }
      else if (b.hasAttribute('data-add')) { if (this.editing) this.commitEdit(); const k = this.nextKey; this.extra.add(k); this.open = null; this.refresh(k); }
      else if (d.day) this.openDay(d.day);
      else if (d.act === 'search') this.toggleSearch();
      else if (d.act === 'clearq') { this.setQuery(''); this.$('.subbar [data-q]').focus(); }
      else if (d.act === 'menu') { if (!this.closeMenu()) this.onMenu(this); }
      else if (d.act === 'sync') this.onSync();
      else if (d.act === 'quick') this.quickEntry();
      else if (d.act === 'bottom') this.flowP.scrollTo({ top: this.flowP.scrollHeight, behavior: 'smooth' });
    });
    R.addEventListener('input', ev => {
      const t = ev.target;
      if (t.dataset.q !== undefined) { this.setQuery(t.value); return; }
      if (t.classList.contains('txt') && t.dataset.k === this.editing) {
        const text = fromDOM(t);
        t.closest('.ent').classList.toggle('empty', !plain(text).trim());
        store.set(t.dataset.k, { text }, 'type'); // lưu nháp liên tục, ✓ để chốt
      }
    });
    // Dán chữ: giữ chữ in đậm (vd copy từ Google Docs), bỏ các định dạng khác
    R.addEventListener('paste', ev => {
      if (!ev.target.closest?.('.txt[contenteditable=true]')) return;
      ev.preventDefault();
      const html = ev.clipboardData.getData('text/html');
      const rich = html ? htmlToRich(html) : ev.clipboardData.getData('text/plain');
      if (rich.includes('**')) document.execCommand('insertHTML', false, toHTML(rich, esc));
      else document.execCommand('insertText', false, rich);
    });
    // Nhớ vùng chữ đang chọn (bấm nút trên màn cảm ứng có thể làm mất vùng chọn)
    document.addEventListener('selectionchange', () => {
      if (!this.editing) return;
      const sel = getSelection(), t = this.$('.ent.editing .txt');
      if (sel.rangeCount && t && t.contains(sel.anchorNode)) this.savedRange = sel.getRangeAt(0).cloneRange();
      this.updateBold();
    });
    // Nút B, ✓ không lấy mất con trỏ/vùng chọn
    const eb = this.$('.editbar');
    eb.addEventListener('pointerdown', e => e.preventDefault());
    eb.addEventListener('mousedown', e => e.preventDefault());
    eb.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    eb.addEventListener('pointerup', e => {
      const b = e.target.closest('button');
      if (!b) return;
      e.preventDefault();
      if (b.dataset.act === 'done') this.commitEdit();
      else if (b.dataset.act === 'bold') {
        this.restoreSel();
        document.execCommand('bold');
        this.updateBold();
        const t = this.$('.ent.editing .txt');
        if (t) store.set(this.editing, { text: fromDOM(t) }, 'type');
      }
    });
    R.addEventListener('keydown', ev => {
      if (!ev.target.classList?.contains('txt')) return;
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); this.$('[data-add]').click(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); this.commitEdit(); }
    });
    // Chạm 2 lần (hoặc double-click) vào nội dung 1 ngày để vào chế độ gõ
    let tap = null, down = null;
    this.flowEl.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    this.flowEl.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
      down = null;
      if (moved > 12 || dt > 400) { tap = null; return; }
      const ent = e.target.closest('.ent');
      if (!ent || e.target.closest('.date,.acts') || ent.dataset.k === this.editing) { tap = null; return; }
      if (this.editing) {
        tap = null;
        this.startEdit(ent.dataset.k, e.clientX, e.clientY);
        return;
      }
      const now = performance.now();
      if (tap && tap.k === ent.dataset.k && now - tap.t < 420 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 40) {
        tap = null;
        getSelection().removeAllRanges();
        this.startEdit(ent.dataset.k, e.clientX, e.clientY);
      } else tap = { k: ent.dataset.k, t: now, x: e.clientX, y: e.clientY };
    });
    // Bàn phím ảo che màn hình: đẩy thanh B / ✓ lên trên bàn phím
    const vv = window.visualViewport;
    if (vv) {
      const fit = () => this.root.style.setProperty('--kb', Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px');
      vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    }
    document.addEventListener('keydown', ev => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'f') {
        ev.preventDefault();
        const i = this.$('.app.desk.wide .searchbar.only-desk input') || (this.toggleSearch(true), null);
        i?.focus(); i?.select();
      } else if (ev.key === 'Escape') {
        if (!this.closeMenu() && !this.editing && this.q) this.setQuery('');
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
        this.swipe(dx);
    });
    // pointerup không tới khi trình duyệt cuộn ngang: dùng touch làm dự phòng
    let tx = null, ty, tt;
    v.addEventListener('touchstart', e => { const p = e.touches[0]; tx = p.clientX; ty = p.clientY; tt = performance.now(); }, { passive: true });
    v.addEventListener('touchend', e => {
      if (this.wide || tx == null) return;
      const p = e.changedTouches[0], dx = p.clientX - tx, dy = p.clientY - ty, dt = performance.now() - tt;
      tx = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && Math.abs(dx) / dt > 0.35 && !getSelection().toString())
        this.swipe(dx);
    });
  }

  // Nút "+ Nhập nhanh": về năm nay, mở Dòng chảy ở hôm nay và vào chế độ gõ.
  // Các ngày từ ngày viết gần nhất tới hôm nay đều hiện sẵn (để trống).
  quickEntry() {
    if (this.editing) this.commitEdit();
    const k = todayKey(), y = +k.slice(0, 4);
    this.year = y;
    this.extra.add(k);
    this.open = null;
    if (!this.wide) this.setMode('flow');
    this.refresh();
    setTimeout(() => {
      const e = this.flowEl.querySelector(`.ent[data-k="${k}"]`);
      if (!e) return;
      e.scrollIntoView({ block: 'center', behavior: 'smooth' });
      e.classList.add('pop');
      setTimeout(() => e.classList.remove('pop'), 1500);
      setTimeout(() => this.startEdit(k), 300);
    }, this.wide ? 20 : 380);
  }

  toggleTags(k) {
    const was = this.open;
    this.flowEl.querySelectorAll('.ent.open').forEach(e => e.classList.remove('open', 'below'));
    this.open = was === k ? null : k;
    const ent = this.open && this.flowEl.querySelector(`.ent[data-k="${k}"]`);
    if (!ent) return;
    ent.querySelector('.acts').innerHTML = this.actsHTML(k);
    // Bảng màu hiện ngay phía trên dòng ngày; nếu sát mép trên màn hình thì hiện phía dưới
    const room = ent.getBoundingClientRect().top - this.flowP.getBoundingClientRect().top;
    ent.classList.toggle('below', room < 64);
    ent.classList.add('open');
    if (this.editing) this.restoreSel();
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

// Vị trí con trỏ tính theo số ký tự trong ô
export function caretOffset(el) {
  const s = getSelection();
  if (!s.rangeCount || !el.contains(s.anchorNode)) return null;
  const r = s.getRangeAt(0).cloneRange();
  r.selectNodeContents(el);
  r.setEnd(s.getRangeAt(0).endContainer, s.getRangeAt(0).endOffset);
  return r.toString().length;
}
export function setCaret(el, n) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = w.nextNode())) {
    if (n <= node.length) { const r = document.createRange(); r.setStart(node, n); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
    n -= node.length;
  }
  placeEnd(el);
}
export function placeEnd(el) {
  const r = document.createRange();
  r.selectNodeContents(el); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
export { keyOf };
