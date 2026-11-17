/* Result transport only: question mapping, BUILD and resultData come from index.html.
 *
 * 支持两种后端，由 submission-config.json 决定，换后端不用改页面、不用重建题目：
 *
 *   {"mode": "obs", "bucket_url": "https://<bucket>.obs.cn-north-4.myhuaweicloud.com/ab"}
 *       → 直接 PUT 一个 JSON 到对象存储（华为云 OBS）。没有服务器、不用备案、成本≈0。
 *         对象名里带 submission_id，重试会覆盖同一个对象，天然幂等。
 *
 *   {"mode": "api", "endpoint": "https://..../api/submit"}
 *       → POST 给一个会返回回执 {ok:true, submission_id} 的后端（兼容原来的 Worker 写法）。
 */
(() => {
  const button = document.getElementById('submit-results');
  const status = document.getElementById('submit-status');
  const listener = document.getElementById('listener');
  const storageKey = PAGE + ':submission:' + BUILD + ':' + location.pathname;
  let saved = null, transport = null, sending = false;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}
  if (saved?.payload && typeof saved.payload.listener === 'string') listener.value = saved.payload.listener;
  function remember() { try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch {} }
  function transportId() {
    if (!transport) return '';
    return transport.mode === 'obs' ? 'obs:' + transport.bucket_url : 'api:' + transport.endpoint;
  }
  const legacyTarget = 'api:https://music-listening-results.music-listening-results.workers.dev/api/submit';
  function safeName(value) {
    return (value || 'anon').replace(/[^0-9A-Za-z\u4e00-\u9fa5_-]/g, '_').slice(0, 32) || 'anon';
  }
  function refresh() {
    // 换后端（比如从 Cloudflare 换到 OBS）后，旧的「已提交」不能挡住补交
    if (saved?.status === 'submitted' && transport && (saved.target || legacyTarget) !== transportId()) {
      saved.status = 'pending';
      delete saved.receipt;
      remember();
    }
    const rows = resultData().trials;
    const complete = rows.every(row => ['a', 'b', '?'].includes(row.choice));
    button.disabled = !complete || !transport || sending || saved?.status === 'submitted';
    listener.disabled = Boolean(saved?.payload);
    if (saved?.status === 'submitted') {
      button.textContent = '已提交';
      status.textContent = '提交成功，组织者已可查看。回执：' + (saved.receipt?.submission_id || '').slice(0, 8);
    } else if (!complete) {
      status.textContent = '答完全部 ' + rows.length + ' 题后，点一次提交即可。';
    } else if (!sending && transport) {
      button.textContent = saved?.payload ? '重试提交' : '提交结果';
      status.textContent = saved?.payload ? '上次提交尚未确认，请重试；不会重复计数。' : '已完成，请点击“提交结果”发送给组织者。';
    }
  }
  document.addEventListener('click', () => { if (!sending) refresh(); });

  async function send(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      if (transport.mode === 'obs') {
        const objectUrl = transport.bucket_url + '/' + BUILD + '/' + safeName(payload.listener) +
          '-' + payload.submission_id + '.json';
        const response = await fetch(objectUrl, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
          signal: controller.signal,
          credentials: 'omit',
        });
        if (!response.ok) throw Error('http_' + response.status);
        return {ok: true, submission_id: payload.submission_id, object: objectUrl};
      }
      const response = await fetch(transport.endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        signal: controller.signal,
        credentials: 'omit',
      });
      const receipt = await response.json();
      if (!response.ok || !receipt.ok || receipt.submission_id !== payload.submission_id) throw Error('submission_failed');
      return receipt;
    } finally {
      clearTimeout(timer);
    }
  }

  button.addEventListener('click', async () => {
    if (sending || !transport || saved?.status === 'submitted') return;
    const payload = resultData();
    if (!payload.trials.every(row => ['a', 'b', '?'].includes(row.choice))) { refresh(); return; }
    if (!saved?.payload) {
      saved = {status: 'pending', payload: {...payload, submission_id: crypto.randomUUID()}};
      remember();
    }
    sending = true;
    refresh();
    status.textContent = '正在提交，请稍候…';
    try {
      saved.receipt = await send(saved.payload);
      saved.status = 'submitted';
      saved.target = transportId();
      sending = false;
      remember();
      refresh();
    } catch (error) {
      sending = false;
      remember();
      refresh();
      status.textContent = '尚未确认提交成功（' + (error.message || 'network') + '）。答案仍保存在此浏览器，' +
        '请换网络或稍后点“重试提交”；也可用下面的备用导出把 JSON 发回组织者。';
    }
  });

  refresh();
  fetch('./submission-config.json', {cache: 'no-store'})
    .then(response => { if (!response.ok) throw Error('config_unavailable'); return response.json(); })
    .then(config => {
      if (config.mode === 'obs') {
        const url = new URL(config.bucket_url);
        // 正式环境必须是 https；127.0.0.1/localhost 放行是为了本地联调
        const local = url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
        if (url.protocol !== 'https:' && !local) throw Error('invalid_endpoint');
        transport = {mode: 'obs', bucket_url: url.href.replace(/\/$/, '')};
      } else {
        const url = new URL(config.endpoint);
        if (url.protocol !== 'https:') throw Error('invalid_endpoint');
        transport = {mode: 'api', endpoint: url.href};
      }
      refresh();
    })
    .catch(() => {
      status.textContent = '提交服务暂时无法连接。答案会保留，请稍后刷新重试；也可使用备用导出。';
    });
})();
