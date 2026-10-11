// Tự cập nhật từ GitHub Releases (satthupc00/Mon_ML)
import { isElectron, isAndroid, appVersion } from './platform.js';
import { registerPlugin } from '@capacitor/core';

const REPO = 'satthupc00/Mon_ML';
const ApkUpdater = registerPlugin('ApkUpdater');

const newer = (a, b) => {
  const pa = a.replace(/^v/, '').split('.').map(Number), pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
};

export function initUpdates(ui) {
  if (isElectron) {
    window.monml.onUpdate(u => {
      if (u.state === 'downloading') ui.banner(`<span>Đang tải bản mới v${u.version}${u.percent ? ` · ${u.percent}%` : ''}…</span>`);
      else if (u.state === 'ready') {
        const b = ui.banner(`<span>Bản mới v${u.version} đã sẵn sàng</span><button>Khởi động lại để cập nhật</button>`);
        b.querySelector('button').onclick = () => window.monml.installUpdate();
      } else if (u.state === 'error') ui.banner('');
    });
    return;
  }
  if (isAndroid) setTimeout(() => checkAndroid(ui), 2500);
}

async function checkAndroid(ui) {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return;
    const rel = await r.json();
    const cur = await appVersion();
    const apk = rel.assets?.find(a => a.name.endsWith('.apk'));
    if (!apk || !newer(rel.tag_name, cur)) return;
    const b = ui.banner(`<span>Có bản mới ${rel.tag_name} (đang dùng v${cur})</span><button>Cập nhật</button>`);
    const btn = b.querySelector('button');
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Đang tải…';
      const sub = await ApkUpdater.addListener('progress', p => { btn.textContent = `Đang tải ${p.percent}%`; });
      try {
        const res = await ApkUpdater.downloadAndInstall({ url: apk.browser_download_url });
        if (res.status === 'need-permission') { ui.toast('Cho phép "Cài app không rõ nguồn" cho Mon ML rồi bấm Cập nhật lại'); }
      } catch (e) { ui.toast('Tải bản cập nhật lỗi: ' + (e.message || e)); }
      sub.remove();
      btn.disabled = false; btn.textContent = 'Cập nhật';
    };
  } catch { /* offline: bỏ qua */ }
}
