// Mon Inkdays — vỏ Electron cho Windows
const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');

const WWW = path.join(__dirname, '..', 'www');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

// Đổi tên app nhưng giữ nguyên thư mục dữ liệu cũ "Mon ML" (đăng nhập, mật khẩu, nháp)
app.setPath('userData', path.join(app.getPath('appData'), 'Mon ML'));

if (!app.requestSingleInstanceLock()) app.quit();

const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return { width: 1180, height: 780 }; }
}
function saveState(win) {
  try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })); } catch { /* bỏ qua */ }
}

let win;
function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    x: st.x, y: st.y, width: st.width, height: st.height, minWidth: 420, minHeight: 560,
    title: 'Mon Inkdays', backgroundColor: '#FFF8F0', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false },
  });
  win.setMenu(null);
  if (st.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveState(win));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.loadURL('app://monml/index.html');
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  protocol.handle('app', req => {
    const { pathname } = new URL(req.url);
    const rel = path.normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname)).replace(/^([/\\])+/, '');
    const file = path.join(WWW, rel);
    if (!file.startsWith(WWW)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  ipcMain.handle('app-version', () => app.getVersion());
  ipcMain.handle('save-file', async (_e, { name, content }) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name) });
    if (r.canceled || !r.filePath) return false;
    await fs.promises.writeFile(r.filePath, content, 'utf8');
    return true;
  });
  ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true));
  // Nút "Kiểm tra cập nhật" trong menu
  ipcMain.handle('check-update', async () => {
    if (!app.isPackaged) return { status: 'dev', version: app.getVersion() };
    try {
      const r = await autoUpdater.checkForUpdates();
      const v = r?.updateInfo?.version;
      if (v && v !== app.getVersion()) return { status: 'available', version: v };
      return { status: 'latest', version: app.getVersion() };
    } catch (e) { return { status: 'error', message: e.message }; }
  });

  createWindow();
  setupUpdates();
});
app.on('window-all-closed', () => app.quit());

// Tự cập nhật từ GitHub Releases
function setupUpdates() {
  if (!app.isPackaged) return;
  const send = d => win && !win.isDestroyed() && win.webContents.send('update', d);
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', i => send({ state: 'downloading', version: i.version }));
  autoUpdater.on('download-progress', p => send({ state: 'downloading', version: autoUpdater.updateInfoAndProvider?.info?.version || '', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', i => send({ state: 'ready', version: i.version }));
  autoUpdater.on('error', e => { console.error(e); send({ state: 'error' }); });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 4000);
  setInterval(check, 6 * 60 * 60 * 1000);
}
