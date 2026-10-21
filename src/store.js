// Kho dữ liệu nhật ký: chạy offline (localStorage) hoặc đồng bộ qua Firebase Firestore.
// Mỗi ngày là 1 document: users/{uid}/entries/{YYYY-MM-DD} = { text, mood, updatedAt }
import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager, memoryLocalCache,
  collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import bundledConfig from './firebase-config.js';

export const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* đầy bộ nhớ hoặc bị chặn */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } },
};
const LOCAL_KEY = 'monml.entries.local';

const AUTH_ERR = {
  'auth/invalid-email': 'Email không hợp lệ',
  'auth/missing-password': 'Chưa nhập mật khẩu',
  'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự',
  'auth/email-already-in-use': 'Email này đã có tài khoản, hãy đăng nhập',
  'auth/invalid-credential': 'Sai email hoặc mật khẩu',
  'auth/wrong-password': 'Sai email hoặc mật khẩu',
  'auth/user-not-found': 'Chưa có tài khoản với email này',
  'auth/too-many-requests': 'Thử sai nhiều quá, đợi một lúc rồi thử lại',
  'auth/network-request-failed': 'Không có mạng',
  'auth/operation-not-allowed': 'Máy chủ đồng bộ chưa bật đăng nhập bằng email',
  'auth/configuration-not-found': 'Máy chủ đồng bộ chưa bật đăng nhập',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Cấu hình đồng bộ không đúng',
};
export const authMessage = e => AUTH_ERR[e?.code] || e?.message || 'Có lỗi xảy ra';

// Đọc config Firebase dán từ console (dạng JS object hoặc JSON)
export function parseFirebaseConfig(txt) {
  if (!txt) return null;
  try { const j = JSON.parse(txt); if (j.apiKey && j.projectId) return j; } catch { /* không phải JSON */ }
  const o = {};
  for (const k of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']) {
    const m = txt.match(new RegExp(k + '["\']?\\s*:\\s*["\']([^"\']+)["\']'));
    if (m) o[k] = m[1];
  }
  return o.apiKey && o.projectId && o.appId ? o : null;
}

class Store {
  constructor() {
    this.entries = LS.get(LOCAL_KEY, {});
    this.listeners = new Set();
    this.status = 'local';
    this.user = null;
    this.pending = new Map();
    this.ready = false;
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
    addEventListener('pagehide', () => this.flush());
  }

  config() { return bundledConfig || LS.get('monml.fbconfig', null); }
  configIsBundled() { return !!bundledConfig; }
  setConfig(cfg) { if (cfg) LS.set('monml.fbconfig', cfg); else LS.del('monml.fbconfig'); }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev) { this.listeners.forEach(f => { try { f(ev); } catch (e) { console.error(e); } }); }
  setStatus(s) { if (this.status !== s) { this.status = s; this.emit({ type: 'status' }); } }

  get(k) { return this.entries[k]; }
  keys() { return Object.keys(this.entries).sort(); }

  // ----- Ghi -----
  set(k, patch, origin = 'ui') {
    const cur = this.entries[k] || { text: '', mood: null };
    const next = { text: cur.text || '', mood: cur.mood || null, ...patch, updatedAt: Date.now() };
    if (!next.text.trim() && !next.mood) delete this.entries[k];
    else this.entries[k] = next;
    this.persist(k, origin === 'type' ? 800 : 0);
    this.emit({ type: 'change', keys: [k], origin });
  }

  // Nhập nhiều ngày một lúc (import)
  async bulk(map) {
    const keys = Object.keys(map);
    for (const k of keys) {
      const e = map[k];
      if (!e.text?.trim() && !e.mood) continue;
      this.entries[k] = { text: e.text || '', mood: e.mood || null, updatedAt: Date.now() };
    }
    if (this.user) {
      for (let i = 0; i < keys.length; i += 400) {
        const b = writeBatch(this.db);
        for (const k of keys.slice(i, i + 400)) {
          const e = this.entries[k];
          if (e) b.set(this.ref(k), { text: e.text, mood: e.mood, updatedAt: e.updatedAt });
        }
        b.commit().catch(err => this.fail(err));
      }
    } else this.saveLocal();
    this.emit({ type: 'change', keys, origin: 'import' });
  }

  persist(k, delay) {
    if (!this.user) { clearTimeout(this._lt); this._lt = setTimeout(() => this.saveLocal(), delay); return; }
    clearTimeout(this.pending.get(k));
    this.pending.set(k, setTimeout(() => this.push(k), delay));
    this.setStatus('syncing');
  }
  saveLocal() { if (!this.user) LS.set(LOCAL_KEY, this.entries); }
  ref(k) { return doc(this.db, 'users', this.user.uid, 'entries', k); }
  push(k) {
    clearTimeout(this.pending.get(k));
    this.pending.delete(k);
    if (!this.user) return;
    const e = this.entries[k];
    // Firestore ghi vào cache ngay (kể cả offline) rồi tự gửi lên server khi có mạng
    const p = e ? setDoc(this.ref(k), { text: e.text, mood: e.mood, updatedAt: e.updatedAt }) : deleteDoc(this.ref(k));
    p.catch(err => this.fail(err));
  }
  flush() {
    clearTimeout(this._lt); if (!this.user) this.saveLocal();
    for (const k of [...this.pending.keys()]) this.push(k);
  }
  fail(err) { console.error(err); this.lastError = err?.message || String(err); this.setStatus('error'); }

  // ----- Firebase -----
  async init() {
    const cfg = this.config();
    if (!cfg) { this.setStatus('local'); this.ready = true; return; }
    try {
      const app = initializeApp(cfg);
      this.auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
      try {
        this.db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) });
      } catch {
        this.db = initializeFirestore(app, { localCache: memoryLocalCache() });
      }
    } catch (err) { this.fail(err); this.ready = true; return; }
    await new Promise(res => {
      let first = true;
      onAuthStateChanged(this.auth, u => { this.onUser(u); if (first) { first = false; res(); } });
    });
    this.ready = true;
  }

  onUser(u) {
    this.unsub?.(); this.unsub = null;
    this.user = u;
    if (!u) {
      this.entries = LS.get(LOCAL_KEY, {});
      this.setStatus('signedout');
      this.emit({ type: 'reset' });
      return;
    }
    // Dữ liệu đã viết khi chưa đăng nhập: đẩy lên tài khoản rồi xoá bản local
    const local = LS.get(LOCAL_KEY, {});
    const carry = Object.keys(local);
    this.entries = {};
    this.setStatus('syncing');
    this.emit({ type: 'reset' });
    let firstSnap = true;
    this.unsub = onSnapshot(collection(this.db, 'users', u.uid, 'entries'), { includeMetadataChanges: true }, snap => {
      const next = {};
      snap.forEach(d => { const x = d.data(); next[d.id] = { text: x.text || '', mood: x.mood || null, updatedAt: x.updatedAt || 0 }; });
      for (const k of this.pending.keys()) { if (this.entries[k]) next[k] = this.entries[k]; else delete next[k]; }
      const changed = [];
      for (const k of new Set([...Object.keys(next), ...Object.keys(this.entries)])) {
        const a = this.entries[k], b = next[k];
        if (!a || !b || a.text !== b.text || a.mood !== b.mood) changed.push(k);
      }
      this.entries = next;
      if (firstSnap) {
        firstSnap = false;
        if (carry.length) {
          const add = {};
          for (const k of carry) if (!next[k] || (local[k].updatedAt || 0) > (next[k].updatedAt || 0)) add[k] = local[k];
          LS.del(LOCAL_KEY);
          if (Object.keys(add).length) this.bulk(add);
        }
      }
      if (changed.length) this.emit({ type: 'change', keys: changed, origin: 'remote' });
      this.setStatus(this.pending.size || snap.metadata.hasPendingWrites ? 'syncing' : snap.metadata.fromCache ? 'offline' : 'synced');
    }, err => this.fail(err));
  }

  async login(email, pw) { await signInWithEmailAndPassword(this.auth, email.trim(), pw); }
  async register(email, pw) { await createUserWithEmailAndPassword(this.auth, email.trim(), pw); }
  async resetPassword(email) { await sendPasswordResetEmail(this.auth, email.trim()); }
  async logout() { this.flush(); await signOut(this.auth); }
}

const store = new Store();
export default store;
