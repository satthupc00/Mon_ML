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

// Nút "Kiểm tra cập nhật" trong menu
export async function checkNow(ui) {
  ui.toast('Đang kiểm tra bản mới…');
  if (isElectron) {
    const r = await window.monml.checkUpdate();
    if (r.status === 'available') ui.toast(`Có bản mới v${r.version}, đang tải về…`);
    else if (r.status === 'latest') ui.toast(`Bạn đang dùng bản mới nhất (v${r.version})`);
    else if (r.status === 'dev') ui.toast('Bản chạy thử, không cập nhật');
    else ui.toast('Không kiểm tra được, thử lại khi có mạng');
    return;
  }
  if (isAndroid) {
    const r = await checkAndroid(ui);
    if (r === 'latest') ui.toast(`Bạn đang dùng bản mới nhất (v${await appVersion()})`);
    else if (r === 'error') ui.toast('Không kiểm tra được, thử lại khi có mạng');
    else if (r === 'available') ui.toast('Có bản mới, bấm "Cập nhật" ở đầu màn hình');
    return;
  }
  ui.toast('Bản web không cần cập nhật');
}

async function checkAndroid(ui) {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) return 'error';
    const rel = await r.json();
    const cur = await appVersion();
    const apk = rel.assets?.find(a => a.name.endsWith('.apk'));
    if (!apk || !newer(rel.tag_name, cur)) return 'latest';
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
    return 'available';
  } catch { return 'error'; }
}
