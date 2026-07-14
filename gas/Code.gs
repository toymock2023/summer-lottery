/**
 * 夏日消暑祭 抽獎後端 — Google Apps Script (V8)
 * 綁定於活動 Google 試算表（三分頁：訂單資料 / 抽獎紀錄 / 獎池庫存）
 */

const SHEET_ORDERS = '訂單資料';
const SHEET_RECORDS = '抽獎紀錄';
const SHEET_POOL = '獎池庫存';
const DRAW_THRESHOLD = 3000;
const TIMEZONE = 'Asia/Taipei';
const ACTIVITY_START = '2026-07-16T00:00:00+08:00';
const ACTIVITY_END = '2026-08-14T23:59:59+08:00';

// 獎項名稱（= C 分頁 A 欄）對應獎品內容與類型，寫入抽獎紀錄時使用
const PRIZES_META = {
  '🍧 刨冰獎': { content: '【SPICE】掛脖式風扇', type: '實物贈品' },
  '🍵 抹茶獎': { content: '【SKATER】胖胖水壺530ml', type: '實物贈品' },
  '🍡 糰子獎': { content: '【MASCLUB】3D涼感口罩10枚入×3包', type: '實物贈品' },
  '🧊 冰沙獎': { content: '本次訂單折 NT$100', type: '本次訂單折扣' },
  '🥤 蘇打獎': { content: '運費折抵券1張【抵扣1箱運費】', type: '運費抵扣券' },
  '🫧 彈珠汽水獎': { content: '本次訂單折 NT$50', type: '本次訂單折扣' },
};

// ========== 純邏輯（Node 測試涵蓋：tests/gas-logic.test.js）==========

function calcTotalDraws(amount) {
  const n = Number(amount);
  if (!isFinite(n) || n < 0) return 0;
  return Math.floor(n / DRAW_THRESHOLD);
}

function pickPrize(pool, rand) {
  const total = pool.reduce((sum, p) => sum + Math.max(0, p.remaining), 0);
  if (total <= 0) return null;
  let r = Math.floor(rand() * total);
  if (r >= total) r = total - 1;
  for (let i = 0; i < pool.length; i++) {
    const remaining = Math.max(0, pool[i].remaining);
    if (r < remaining) return pool[i];
    r -= remaining;
  }
  return null;
}

function normalizeId(v) {
  return String(v == null ? '' : v).trim().toUpperCase();
}

// GAS V8 runtime 的 Intl/ICU 資料不穩定，Number.prototype.toLocaleString()
// 在部署環境下可能不產生千分位逗號，因此一律手動格式化。
function formatMoney(amount) {
  const n = Math.round(Number(amount) || 0);
  const sign = n < 0 ? '-' : '';
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function checkActivityPeriod(now) {
  const t = now.getTime();
  if (t < new Date(ACTIVITY_START).getTime()) return 'NOT_STARTED';
  if (t > new Date(ACTIVITY_END).getTime()) return 'ENDED';
  return 'ACTIVE';
}
