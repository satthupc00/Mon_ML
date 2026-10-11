export const WD = ['cn', 't2', 't3', 't4', 't5', 't6', 't7'];
export const pad2 = n => String(n).padStart(2, '0');
export const keyOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseK = k => { const [a, b, c] = k.split('-').map(Number); return new Date(a, b - 1, c); };
export const label = k => { const d = parseK(k); return `${d.getDate()}/${d.getMonth() + 1} ${WD[d.getDay()]}`; };
export const addDay = (k, n) => { const d = parseK(k); d.setDate(d.getDate() + n); return keyOf(d); };
export const todayKey = () => keyOf(new Date());
export const isKey = k => /^\d{4}-\d\d-\d\d$/.test(k) && keyOf(parseK(k)) === k;
