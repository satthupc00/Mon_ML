// Báo lỗi lên màn hình nếu app không khởi động được (để chụp màn hình gửi lại)
(function () {
  var errs = [];
  function push(m) { errs.push(String(m).slice(0, 600)); }
  window.addEventListener('error', function (e) { push((e.error && e.error.stack) || e.message); });
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; push((r && (r.stack || r.message)) || r); });
  setTimeout(function () {
    var a = document.querySelector('.app');
    if (a && !a.classList.contains('locked')) return;
    if (document.querySelector('.lock')) return;
    var d = document.createElement('pre');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:999;background:#2E2A2B;color:#fff;padding:12px;border-radius:12px;font:12px/1.45 monospace;white-space:pre-wrap;max-height:50vh;overflow:auto;border-left:3px solid #E5383B';
    d.textContent = 'Mon Inkdays không khởi động được. Hãy chụp màn hình này gửi lại.\n\n' + (errs.join('\n\n') || 'Không có thông báo lỗi.');
    document.body.appendChild(d);
  }, 7000);
})();
