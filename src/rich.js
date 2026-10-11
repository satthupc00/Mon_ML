// Định dạng chữ: lưu dạng văn bản thường, đoạn in đậm bọc trong **…**
export const plain = t => (t || '').replace(/\*\*/g, '');

export function segments(t) {
  const out = [], re = /\*\*([\s\S]+?)\*\*/g;
  let i = 0, m;
  t = t || '';
  while ((m = re.exec(t))) {
    if (m.index > i) out.push({ t: t.slice(i, m.index), b: false });
    out.push({ t: m[1], b: true });
    i = re.lastIndex;
  }
  if (i < t.length) out.push({ t: t.slice(i), b: false });
  return out;
}

// fmt: hàm chuyển 1 đoạn chữ thường thành HTML (escape + tô từ khóa)
export const toHTML = (t, fmt) => segments(t).map(s => (s.b ? `<b>${fmt(s.t)}</b>` : fmt(s.t))).join('');

// Chữ đậm nếu: có font-weight rõ ràng >= 600, hoặc là thẻ <b>/<strong> mà không bị ghi đè font-weight thường.
// (Google Docs bọc cả đoạn copy trong <b style="font-weight:normal">, chữ đậm thật là <span style="font-weight:700">)
const boldOf = (n, inherited) => {
  const fw = n.style?.fontWeight;
  if (fw) return fw === 'bold' || fw === 'bolder' || +fw >= 600;
  if (/^(B|STRONG)$/.test(n.nodeName)) return true;
  return inherited;
};
const BLOCK = /^(DIV|P|LI|H[1-6]|TR|BLOCKQUOTE|PRE)$/;

// Đọc nội dung ô đang gõ (contenteditable) thành văn bản có **…**
export function fromDOM(el) {
  const segs = [];
  const push = (t, b) => { const l = segs.at(-1); if (l && l.b === b) l.t += t; else segs.push({ t, b }); };
  const walk = (n, b) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) push(c.nodeValue, b);
      else if (c.nodeName === 'BR') push('\n', false);
      else if (c.nodeType === 1) {
        if (/^(STYLE|SCRIPT|META|TITLE)$/.test(c.nodeName)) continue;
        if (BLOCK.test(c.nodeName)) { const l = segs.at(-1); if (l && !l.t.endsWith('\n')) push('\n', false); }
        walk(c, boldOf(c, b));
      }
    }
  };
  walk(el, false);
  return segs.map(x => {
    if (!x.b) return x.t;
    const m = x.t.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m[2] ? `${m[1]}**${m[2]}**${m[3]}` : x.t;
  }).join('').replace(/\u00a0/g, ' ').replace(/\n$/, '');
}

// HTML trong clipboard (vd copy từ Google Docs) → văn bản có **…**
export function htmlToRich(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return fromDOM(doc.body).replace(/\n{3,}/g, '\n\n').trim();
}
