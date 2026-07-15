'use strict';

(function () {
  const $ = (id) => document.getElementById(id);

  const state = { customerId: '', orderId: '', remaining: 0, drawing: false };

  const ERROR_FALLBACK = {
    ORDER_NOT_FOUND: '查無此訂單，請確認訂單號碼是否正確',
    CUSTOMER_MISMATCH: '客戶編號與訂單不符，請確認後重新輸入',
    NO_DRAWS_LEFT: '此訂單的抽獎次數已全部使用完畢 ✅',
    POOL_EMPTY: '🎉 活動獎品已全數抽出，感謝您的參與！',
    BUSY: '目前抽獎人數眾多，請稍後再試',
  };

  function errorText(err) {
    if (!err) return '連線異常，請稍後再試';
    return err.message || ERROR_FALLBACK[err.code] || '連線異常，請稍後再試';
  }

  function fmtMoney(n) {
    return 'NT$' + Number(n).toLocaleString('zh-Hant-TW');
  }

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  function showMessage(kind, text) {
    const box = $('message');
    box.textContent = text;
    box.className = 'message ' + kind;
    show(box);
  }
  function clearMessage() { hide($('message')); }

  // ---------- 獎池渲染 ----------
  function renderPool(data) {
    const grid = $('prize-grid');
    grid.innerHTML = data.prizes.map((p) => {
      const meta = PRIZES.find((m) => m.name === p.name) || {};
      const out = p.remaining <= 0;
      return [
        '<div class="prize-row', out ? ' is-out' : '', '">',
        '<span class="prize-emoji">', meta.emoji || '🎁', '</span>',
        '<div class="prize-main">',
        '<p class="prize-name">', p.name, '</p>',
        '<p class="prize-content">', meta.content || '', '</p>',
        '</div>',
        '<span class="prize-type type-', meta.typeClass || 'physical', '">', meta.type || '', '</span>',
        '<span class="prize-remaining">', out ? '已抽完' : '剩餘 ' + p.remaining + ' 份', '</span>',
        '</div>',
      ].join('');
    }).join('');

    const status = $('pool-status');
    if (data.totalRemaining <= 0) {
      status.textContent = '🎉 活動獎品已全數抽出，感謝參與！';
      status.classList.add('is-empty');
    } else {
      status.textContent = '🔥 現場抽獎熱熱鬧鬧進行中！';
      status.classList.remove('is-empty');
    }
  }

  async function refreshPool() {
    try {
      const res = await api.pool();
      if (res.success) renderPool(res.data);
      else $('pool-status').textContent = errorText(res.error);
    } catch (err) {
      $('pool-status').textContent = '獎池載入失敗，請重新整理頁面';
    }
  }

  // ---------- 查詢抽獎資格 ----------
  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.textContent = label;
  }

  function renderStatus(d) {
    $('status-hello').textContent = '您好，客戶 ' + d.customerId + '！';
    $('status-amount').textContent = '訂單金額：' + fmtMoney(d.amount);
    const drawBtn = $('draw-btn');
    if (d.remainingDraws > 0) {
      $('status-draws').textContent =
        '您本次訂單可抽 ' + d.totalDraws + ' 次，已抽 ' + d.usedDraws + ' 次，剩餘 ' + d.remainingDraws + ' 次';
      show(drawBtn);
      drawBtn.disabled = false;
    } else {
      $('status-draws').textContent = '此訂單的抽獎次數已全部使用完畢 ✅';
      hide(drawBtn);
    }
    show($('status-panel'));
  }

  async function onVerify(event) {
    event.preventDefault();
    clearMessage();
    hide($('status-panel'));
    hide($('draw-result'));
    hide($('gacha-stage'));

    const customerId = $('customer-id').value.trim();
    const orderId = $('order-id').value.trim();
    if (!customerId || !orderId) {
      showMessage('error', '請輸入客戶編號與訂單號碼');
      return;
    }

    const btn = $('verify-btn');
    setBusy(btn, true, '查詢中…');
    try {
      const res = await api.query(customerId, orderId);
      if (!res.success) {
        showMessage('error', errorText(res.error));
        return;
      }
      state.customerId = customerId;
      state.orderId = orderId;
      state.remaining = res.data.remainingDraws;
      renderStatus(res.data);
    } catch (err) {
      showMessage('error', '連線異常，請稍後再試');
    } finally {
      setBusy(btn, false, '🔍 查詢抽獎資格');
    }
  }

  // ---------- 抽獎 ----------
  function renderResult(d) {
    $('result-prize').textContent = d.prizeName;
    $('result-content').textContent = d.prizeContent;
    const meta = PRIZES.find((m) => m.name === d.prizeName) || {};
    const typeEl = $('result-type');
    typeEl.textContent = d.prizeType;
    typeEl.className = 'prize-type type-' + (meta.typeClass || 'physical');
    $('result-note').textContent = TYPE_NOTES[d.prizeType] || '';

    const againBtn = $('again-btn');
    if (d.remainingDraws > 0) {
      $('result-remaining').textContent = '還可以再抽 ' + d.remainingDraws + ' 次！';
      show(againBtn);
      againBtn.disabled = false;
    } else {
      $('result-remaining').textContent = '此訂單的抽獎次數已全部使用完畢 ✅';
      hide(againBtn);
    }
    show($('draw-result'));
    $('draw-result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function onDraw() {
    if (state.drawing || state.remaining <= 0) return;
    state.drawing = true;
    clearMessage();
    hide($('draw-result'));
    $('draw-btn').disabled = true;
    $('again-btn').disabled = true;

    show($('gacha-stage'));
    document.body.classList.add('no-scroll');

    const spinDone = gacha.spin(2500);
    let res;
    try {
      res = await api.draw(state.customerId, state.orderId);
    } catch (err) {
      res = { success: false, error: { code: 'NETWORK', message: '連線異常，請稍後再試' } };
    }
    await spinDone;

    if (!res.success) {
      gacha.reset();
      hide($('gacha-stage'));
      document.body.classList.remove('no-scroll');
      showMessage('error', errorText(res.error));
      if (res.error && (res.error.code === 'NO_DRAWS_LEFT' || res.error.code === 'POOL_EMPTY')) {
        state.remaining = 0;
        hide($('draw-btn'));
      } else {
        $('draw-btn').disabled = false;
        $('again-btn').disabled = false;
      }
      state.drawing = false;
      return;
    }

    const d = res.data;
    state.remaining = d.remainingDraws;
    await gacha.drop();
    hide($('gacha-stage'));
    document.body.classList.remove('no-scroll');
    gacha.reset();
    renderResult(d);
    gacha.confetti();

    if (d.pool) renderPool(d.pool);
    if (d.remainingDraws > 0) {
      $('status-draws').textContent = '剩餘 ' + d.remainingDraws + ' 次抽獎機會';
      $('draw-btn').disabled = false;
    } else {
      $('status-draws').textContent = '此訂單的抽獎次數已全部使用完畢 ✅';
      hide($('draw-btn'));
    }
    state.drawing = false;
  }

  // ---------- 初始化 ----------
  function init() {
    gacha.init();
    $('verify-form').addEventListener('submit', onVerify);
    $('draw-btn').addEventListener('click', onDraw);
    $('again-btn').addEventListener('click', onDraw);
    refreshPool();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
