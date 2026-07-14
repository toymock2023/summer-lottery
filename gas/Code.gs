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
// ⚠️ 測試用開關：true 時 query/draw 會略過活動日期檢查（前台顯示的活動期間文案不受影響）。
// 上線前必須改回 false，否則 8/14 之後客人仍可持續抽獎。
const TESTING_SKIP_DATE_CHECK = true;

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

// ========== HTTP 入口 ==========

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput(errorResponse('BAD_REQUEST', '請求格式錯誤'));
  }
  try {
    switch (req.action) {
      case 'pool':
        return jsonOutput(handlePool());
      case 'query':
        return jsonOutput(handleQuery(req.customerId, req.orderId));
      case 'draw':
        return jsonOutput(handleDraw(req.customerId, req.orderId));
      default:
        return jsonOutput(errorResponse('BAD_REQUEST', '未知的 action'));
    }
  } catch (err) {
    console.error(err);
    return jsonOutput(errorResponse('SERVER_ERROR', '系統忙碌中，請稍後再試'));
  }
}

function doGet() {
  return jsonOutput({ success: true, data: { status: 'ok', service: '夏日消暑祭抽獎 API' } });
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(code, message, extra) {
  const error = { code: code, message: message };
  if (extra) Object.assign(error, extra);
  return { success: false, error: error };
}

// ========== Sheets 存取 ==========

function getSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('找不到分頁：' + name);
  return sheet;
}

function findOrder(orderId) {
  const rows = getSheet(SHEET_ORDERS).getDataRange().getValues();
  const target = normalizeId(orderId);
  for (let i = 1; i < rows.length; i++) {
    if (normalizeId(rows[i][1]) === target) {
      return {
        customerId: normalizeId(rows[i][0]),
        orderId: String(rows[i][1]).trim(),
        amount: Number(rows[i][2]),
      };
    }
  }
  return null;
}

function countUsedDraws(orderId) {
  const rows = getSheet(SHEET_RECORDS).getDataRange().getValues();
  const target = normalizeId(orderId);
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    if (normalizeId(rows[i][2]) === target) count++;
  }
  return count;
}

function readPool() {
  const sheet = getSheet(SHEET_POOL);
  const rows = sheet.getDataRange().getValues();
  const pool = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    pool.push({
      name: String(rows[i][0]).trim(),
      initial: Number(rows[i][1]),
      drawn: Number(rows[i][2]),
      remaining: Number(rows[i][3]),
      row: i + 1,
    });
  }
  return { sheet: sheet, pool: pool };
}

function poolData(pool) {
  return {
    prizes: pool.map((p) => ({ name: p.name, initial: p.initial, remaining: p.remaining })),
    totalRemaining: pool.reduce((s, p) => s + Math.max(0, p.remaining), 0),
  };
}

// ========== 驗證 ==========

function validateOrder(customerId, orderId) {
  if (!TESTING_SKIP_DATE_CHECK) {
    const periodStatus = checkActivityPeriod(new Date());
    if (periodStatus === 'NOT_STARTED') {
      return { error: errorResponse('EVENT_NOT_STARTED', '活動尚未開始，開始時間為 2026/07/16') };
    }
    if (periodStatus === 'ENDED') {
      return { error: errorResponse('EVENT_ENDED', '活動已於 2026/08/14 結束，感謝您的參與！') };
    }
  }
  if (!normalizeId(customerId) || !normalizeId(orderId)) {
    return { error: errorResponse('BAD_REQUEST', '請輸入客戶編號與訂單號碼') };
  }
  const order = findOrder(orderId);
  if (!order) {
    return { error: errorResponse('ORDER_NOT_FOUND', '查無此訂單，請確認訂單號碼是否正確') };
  }
  if (order.customerId !== normalizeId(customerId)) {
    return { error: errorResponse('CUSTOMER_MISMATCH', '客戶編號與訂單不符，請確認後重新輸入') };
  }
  if (order.amount < DRAW_THRESHOLD) {
    return {
      error: errorResponse(
        'BELOW_THRESHOLD',
        '此訂單金額為 NT$' + formatMoney(order.amount) + '，未達抽獎門檻 NT$3,000',
        { amount: order.amount }
      ),
    };
  }
  const totalDraws = calcTotalDraws(order.amount);
  const usedDraws = countUsedDraws(orderId);
  return {
    order: order,
    totalDraws: totalDraws,
    usedDraws: usedDraws,
    remainingDraws: Math.max(0, totalDraws - usedDraws),
  };
}

// ========== Handlers ==========

function handlePool() {
  return { success: true, data: poolData(readPool().pool) };
}

function handleQuery(customerId, orderId) {
  const v = validateOrder(customerId, orderId);
  if (v.error) return v.error;
  return {
    success: true,
    data: {
      customerId: v.order.customerId,
      amount: v.order.amount,
      totalDraws: v.totalDraws,
      usedDraws: v.usedDraws,
      remainingDraws: v.remainingDraws,
    },
  };
}

function handleDraw(customerId, orderId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return errorResponse('BUSY', '目前抽獎人數眾多，請稍後再試');
  }
  try {
    const v = validateOrder(customerId, orderId);
    if (v.error) return v.error;
    if (v.remainingDraws <= 0) {
      return errorResponse('NO_DRAWS_LEFT', '此訂單的抽獎次數已全部使用完畢 ✅');
    }

    const bundle = readPool();
    const prize = pickPrize(bundle.pool, Math.random);
    if (!prize) {
      return errorResponse('POOL_EMPTY', '🎉 活動獎品已全數抽出，感謝您的參與！');
    }

    // 更新庫存（C 欄：已抽出、D 欄：剩餘）
    bundle.sheet.getRange(prize.row, 3).setValue(prize.drawn + 1);
    bundle.sheet.getRange(prize.row, 4).setValue(prize.remaining - 1);

    // 寫入抽獎紀錄
    const meta = PRIZES_META[prize.name] || { content: '', type: '' };
    const drawNo = v.usedDraws + 1;
    getSheet(SHEET_RECORDS).appendRow([
      Utilities.formatDate(new Date(), TIMEZONE, 'yyyy/MM/dd HH:mm:ss'),
      v.order.customerId,
      v.order.orderId,
      v.order.amount,
      '第' + drawNo + '次',
      prize.name,
      meta.content,
      meta.type,
    ]);
    SpreadsheetApp.flush();

    prize.remaining -= 1;
    prize.drawn += 1;
    return {
      success: true,
      data: {
        prizeName: prize.name,
        prizeContent: meta.content,
        prizeType: meta.type,
        drawNo: drawNo,
        remainingDraws: v.remainingDraws - 1,
        pool: poolData(bundle.pool),
      },
    };
  } finally {
    lock.releaseLock();
  }
}
