// Đóng gói giao diện (src/) thành www/ dùng chung cho Electron và Android
import { build } from 'esbuild';
import { rmSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });

await build({
  entryPoints: { app: 'src/main.js' },
  bundle: true, format: 'esm', target: ['chrome110'], minify: true, sourcemap: false,
  outdir: 'www', define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  legalComments: 'none', logLevel: 'warning',
});
await build({
  entryPoints: { app: 'src/styles.css' },
  bundle: true, minify: true, outdir: 'www', assetNames: 'fonts/[name]',
  loader: { '.woff2': 'file', '.woff': 'file' }, logLevel: 'warning',
});
for (const f of ['index.html', 'icon.svg']) copyFileSync('src/' + f, 'www/' + f);
console.log('www/ built, version', pkg.version);
