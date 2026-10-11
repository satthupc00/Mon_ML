// Gộp www/ thành 1 file HTML chạy thẳng trên trình duyệt (bản xem thử, lưu trên máy, không đồng bộ)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const b64 = f => readFileSync(f).toString('base64');
let css = readFileSync('www/app.css', 'utf8');
for (const f of readdirSync('www/fonts')) {
  const mime = f.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
  css = css.split(`./fonts/${f}`).join(`data:${mime};base64,${b64('www/fonts/' + f)}`);
}
const icon = `data:image/svg+xml;base64,${b64('www/icon.svg')}`;
const js = readFileSync('www/app.js', 'utf8').split('"icon.svg"').join(JSON.stringify(icon)).replace(/<\/script/g, '<\\/script');
const html = readFileSync('www/index.html', 'utf8')
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '')
  .replace('<link rel="icon" href="icon.svg">', `<link rel="icon" href="${icon}">`)
  .replace('<link rel="stylesheet" href="app.css">', () => `<style>${css}</style>`)
  .replace('<script src="err.js"></script>', () => `<script>${readFileSync('www/err.js', 'utf8')}</script>`)
  .replace('<script type="module" src="app.js"></script>', () => `<script type="module">${js}</script>`);
mkdirSync('release-files', { recursive: true });
writeFileSync('release-files/MonML-preview.html', html);
console.log('preview size', (html.length / 1024).toFixed(0), 'KB');
