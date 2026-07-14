'use strict';

// 以 text/plain 送出 JSON 字串：屬於「簡單請求」，不觸發 CORS preflight，
// 這是呼叫 GAS Web App 的標準做法。
async function callApi(payload) {
  if (!CONFIG.API_URL) {
    throw new Error('尚未設定 API URL（請編輯 js/config.js）');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const api = {
  pool: () => callApi({ action: 'pool' }),
  query: (customerId, orderId) => callApi({ action: 'query', customerId: customerId, orderId: orderId }),
  draw: (customerId, orderId) => callApi({ action: 'draw', customerId: customerId, orderId: orderId }),
};
