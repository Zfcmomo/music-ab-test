/* Result transport only: question mapping, BUILD and resultData come from index.html. */
(() => {
  const button = document.getElementById('submit-results');
  const status = document.getElementById('submit-status');
  const listener = document.getElementById('listener');
  const key = PAGE + ':submission:' + BUILD + ':' + location.pathname;
  let saved = null, endpoint = '', sending = false;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  if (saved?.payload && typeof saved.payload.listener === 'string') listener.value = saved.payload.listener;
  function remember() { try { localStorage.setItem(key, JSON.stringify(saved)); } catch {} }
  function refresh() {
    const complete = resultData().trials.every(row => ['a','b','?'].includes(row.choice));
    button.disabled = !complete || !endpoint || sending || saved?.status === 'submitted';
    listener.disabled = Boolean(saved?.payload);
    if (saved?.status === 'submitted') {
      button.textContent = '已提交';
      status.textContent = '提交成功，组织者已可在后台查看。回执：' + saved.receipt.submission_id;
    } else if (!complete) {
      status.textContent = '答完全部 12 题后，点一次提交即可。';
    } else if (!sending && endpoint) {
      button.textContent = saved?.payload ? '重试提交' : '提交结果';
      status.textContent = saved?.payload ? '上次提交尚未确认，请重试；不会重复计数。' : '已完成，请点击“提交结果”发送给组织者。';
    }
  }
  document.addEventListener('click', () => { if (!sending) refresh(); });
  button.addEventListener('click', async () => {
    if (sending || !endpoint || saved?.status === 'submitted') return;
    const payload = resultData();
    if (!payload.trials.every(row => ['a','b','?'].includes(row.choice))) { refresh(); return; }
    if (!saved?.payload) {
      saved = {status:'pending', payload:{...payload, submission_id:crypto.randomUUID()}};
      remember();
    }
    sending = true;
    refresh();
    status.textContent = '正在提交，请稍候…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(saved.payload), signal:controller.signal, credentials:'omit'});
      const receipt = await response.json();
      if (!response.ok || !receipt.ok || receipt.submission_id !== saved.payload.submission_id) throw Error('submission_failed');
      saved.status = 'submitted'; saved.receipt = receipt; remember();
      sending = false; refresh();
    } catch {
      sending = false; refresh();
      status.textContent = '尚未确认提交成功，答案仍保存在此浏览器。请换网络或稍后点“重试提交”；也可使用下面的备用导出。';
    } finally { clearTimeout(timer); }
  });
  refresh();
  fetch('./submission-config.json', {cache:'no-store'}).then(response => {
    if (!response.ok) throw Error('config_unavailable');
    return response.json();
  }).then(config => {
    const url = new URL(config.endpoint);
    if (url.protocol !== 'https:' || url.pathname !== '/api/submit') throw Error('invalid_endpoint');
    endpoint = url.href; refresh();
  }).catch(() => { status.textContent = '提交服务暂时无法连接。答案会保留，请稍后刷新重试；也可使用备用导出。'; });
})();
