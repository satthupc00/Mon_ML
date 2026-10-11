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

const isBold = n => {
  if (n.nodeName === 'B' || n.nodeName === 'STRONG') return true;
  const fw = n.style?.fontWeight;
  return fw === 'bold' || +fw >= 600;
};

// Đọc nội dung ô đang gõ (contenteditable) thành văn bản có **…**
export function fromDOM(el) {
  const segs = [];
  const push = (t, b) => { const l = segs.at(-1); if (l && l.b === b) l.t += t; else segs.push({ t, b }); };
  const walk = (n, b) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) push(c.nodeValue, b);
      else if (c.nodeName === 'BR') push('\n', false);
      else if (c.nodeType === 1) {
        if (/^(DIV|P|LI)$/.test(c.nodeName)) { const l = segs.at(-1); if (l && !l.t.endsWith('\n')) push('\n', false); }
        walk(c, b || isBold(c));
      }
    }
  };
  walk(el, false);
  return segs.map(x => {
    if (!x.b) return x.t;
    const m = x.t.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m[2] ? `${m[1]}**${m[2]}**${m[3]}` : x.t;
  }).join('').replace(/ /g, ' ').replace(/\n$/, '');
}
