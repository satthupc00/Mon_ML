// Vẽ icon + splash cho Windows và Android từ src/icon.svg (cần Playwright/Chromium)
// Chạy: node scripts/make-icons.mjs   (PLAYWRIGHT_PATH trỏ tới module playwright nếu không cài trong dự án)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import pngToIco from 'png-to-ico';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const svg = readFileSync('src/icon.svg', 'utf8');
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const motif = inner.replace(/<rect x="16"[^>]*\/>/, ''); // bỏ nền, giữ cuốn sổ
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate(54 54) scale(0.165) translate(-263 -258)">${motif}</g></svg>`;
const round = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><circle cx="54" cy="54" r="54" fill="#262930"/><g transform="translate(54 54) scale(0.15) translate(-263 -258)">${motif}</g></svg>`;

const b = await chromium.launch();
const page = await b.newPage();
async function render(svgText, w, h, out, bg = 'transparent', scale = 1) {
  await page.setViewportSize({ width: w, height: h });
  const s = Math.min(w, h) * scale;
  await page.setContent(`<html><body style="margin:0;background:${bg};width:${w}px;height:${h}px;display:grid;place-items:center;overflow:hidden"><div style="width:${s}px;height:${s}px">${svgText.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div></body></html>`);
  const buf = await page.screenshot({ omitBackground: bg === 'transparent', type: 'png' });
  mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(out, buf);
  return buf;
}

// Windows
const sizes = [16, 24, 32, 48, 64, 128, 256];
const bufs = [];
for (const s of sizes) bufs.push(await render(svg, s, s, `build/ico-${s}.png`));
await render(svg, 512, 512, 'build/icon.png');
writeFileSync('build/icon.ico', await pngToIco(bufs));
for (const s of sizes) { try { (await import('node:fs')).unlinkSync(`build/ico-${s}.png`); } catch { } }

// Android launcher icons
const RES = 'android/app/src/main/res';
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  await render(svg, 48 * k, 48 * k, `${RES}/mipmap-${d}/ic_launcher.png`);
  await render(round, 48 * k, 48 * k, `${RES}/mipmap-${d}/ic_launcher_round.png`);
  await render(fg, 108 * k, 108 * k, `${RES}/mipmap-${d}/ic_launcher_foreground.png`);
}
// Splash: giữ đúng kích thước file gốc của template
const sizeOf = f => { const x = readFileSync(f); return [x.readUInt32BE(16), x.readUInt32BE(20)]; };
for (const dir of readdirSync(RES).filter(n => n.startsWith('drawable'))) {
  const f = `${RES}/${dir}/splash.png`;
  if (!existsSync(f)) continue;
  const [w, h] = sizeOf(f);
  await render(svg, w, h, f, '#FFF8F0', 0.28);
}
await b.close();
console.log('icons done');
