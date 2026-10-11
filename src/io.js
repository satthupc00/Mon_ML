// Xuất / nhập dữ liệu
import { isElectron, isNative } from './platform.js';
import { label, pad2, isKey, keyOf, parseK } from './dates.js';
import store from './store.js';
import { plain } from './rich.js';

export function exportJSON() {
  const entries = {};
  for (const k of store.keys()) { const e = store.get(k); entries[k] = { text: e.text, mood: e.mood || null }; }
  return JSON.stringify({ app: 'Mon ML', format: 1, exportedAt: new Date().toISOString(), entries }, null, 1);
}

// Văn bản kiểu Google Docs: mỗi ngày một dòng "d/m tX nội dung"
export function exportTXT(year, days) {
  return `ML ${year}\n` + days.map(k => `${label(k)} ${plain(store.get(k)?.text)}`.trimEnd()).join('\n') + '\n';
}

// Trả về { entries: {key:{text,mood}}, count }
export function parseImport(text, year) {
  const t = text.replace(/^﻿/, '');
  try {
    const j = JSON.parse(t);
    const src = j.entries || j;
    const out = {};
    for (const [k, v] of Object.entries(src)) {
      if (!isKey(k)) continue;
      const e = typeof v === 'string' ? { text: v } : v;
      out[k] = { text: String(e.text || ''), mood: ['pos', 'neg', 'trip'].includes(e.mood) ? e.mood : null };
    }
    return { entries: out, count: Object.keys(out).length, kind: 'json' };
  } catch { /* không phải JSON → đọc như văn bản */ }
  const out = {};
  let cur = null, y = year, lastMonth = 0;
  for (const raw of t.split(/\r?\n/)) {
    const line = raw.trim();
    const hy = line.match(/^ML\s+(\d{4})$/i);
    if (hy) { y = +hy[1]; lastMonth = 0; cur = null; continue; }
    const m = line.match(/^(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?(?:\s+(?:t\s?[2-7]|cn|thứ\s?[2-7]|chủ nhật))?\b[\s.,:;–-]*(.*)$/i);
    if (m) {
      const d = +m[1], mo = +m[2];
      let yy = m[3] ? +m[3] : y;
      if (yy < 100) yy += 2000;
      if (!m[3] && lastMonth === 12 && mo === 1) y = yy = y + 1; // qua năm mới trong cùng văn bản
      const k = `${yy}-${pad2(mo)}-${pad2(d)}`;
      if (mo >= 1 && mo <= 12 && isKey(k)) {
        lastMonth = mo;
        cur = k;
        out[k] = { text: (out[k]?.text ? out[k].text + '\n' : '') + m[4], mood: store.get(k)?.mood || null };
        continue;
      }
    }
    if (cur && line) out[cur].text += (out[cur].text ? '\n' : '') + line;
  }
  return { entries: out, count: Object.keys(out).length, kind: 'text' };
}

export async function saveFile(name, content, mime = 'text/plain') {
  if (isElectron) return window.monml.saveFile(name, content);
  if (isNative) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const r = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, files: [r.uri], dialogTitle: 'Lưu / gửi file' });
    return true;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}

export const stamp = () => keyOf(new Date());
export { parseK };
