// Xuất icon Mon Inkdays cho Windows + Android từ bộ file gốc trong logo/final/ (dựng bằng logo/final/build.py)
// Chạy: PLAYWRIGHT_PATH=<đường dẫn module playwright> node scripts/make-icons.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pngToIco from 'png-to-ico';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const SRC = 'logo/final/';
const svg = n => readFileSync(SRC + n, 'utf8');

const b = await chromium.launch();
const page = await b.newPage();
async function render(svgText, w, h, out, { bg = 'transparent', scale = 1 } = {}) {
  await page.setViewportSize({ width: w, height: h });
  const s = Math.min(w, h) * scale;
  await page.setContent(`<html><body style="margin:0;background:${bg};width:${w}px;height:${h}px;display:grid;place-items:center;overflow:hidden"><div style="width:${s}px;height:${s}px">${svgText.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div></body></html>`);
  await page.waitForTimeout(50);
  const buf = await page.screenshot({ omitBackground: bg === 'transparent', type: 'png' });
  mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(out, buf);
  return buf;
}

// Giao diện app + favicon
copyFileSync(SRC + 'icon.svg', 'src/icon.svg');

// Windows
const icon = svg('icon.svg');
const bufs = [];
for (const s of [16, 24, 32, 48, 64, 128, 256]) bufs.push(await render(icon, s, s, `/tmp/monml-ico-${s}.png`));
await render(icon, 512, 512, 'build/icon.png');
await render(icon, 1024, 1024, 'logo/final/icon-1024.png');
writeFileSync('build/icon.ico', await pngToIco(bufs));

// Android: icon cũ (API < 26), adaptive icon (nền + lớp trước + đơn sắc)
const RES = 'android/app/src/main/res';
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const fg = svg('foreground.svg'), bgL = svg('background.svg'), mono = svg('monochrome.svg'), round = svg('round.svg');
for (const [d, k] of Object.entries(dens)) {
  await render(icon, 48 * k, 48 * k, `${RES}/mipmap-${d}/ic_launcher.png`);
  await render(round, 48 * k, 48 * k, `${RES}/mipmap-${d}/ic_launcher_round.png`);
  await render(fg, 108 * k, 108 * k, `${RES}/mipmap-${d}/ic_launcher_foreground.png`);
  await render(bgL, 108 * k, 108 * k, `${RES}/mipmap-${d}/ic_launcher_background.png`);
  await render(mono, 108 * k, 108 * k, `${RES}/mipmap-${d}/ic_launcher_monochrome.png`);
}
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
for (const n of ['ic_launcher.xml', 'ic_launcher_round.xml']) writeFileSync(`${RES}/mipmap-anydpi-v26/${n}`, adaptive);

// Splash (Android < 12): giữ đúng kích thước file gốc của template
const sizeOf = f => { const x = readFileSync(f); return [x.readUInt32BE(16), x.readUInt32BE(20)]; };
for (const dir of readdirSync(RES).filter(n => n.startsWith('drawable'))) {
  const f = `${RES}/${dir}/splash.png`;
  if (!existsSync(f)) continue;
  const [w, h] = sizeOf(f);
  await render(icon, w, h, f, { bg: '#FFF8F0', scale: 0.3 });
}
await b.close();
console.log('icons done');
