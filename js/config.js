'use strict';

// ===== 部署設定 =====
// 部署 GAS Web App 後，將取得的 URL 貼入 API_URL，例如：
// https://script.google.com/macros/s/XXXXXXXX/exec
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxgIIcPr2mCTp7P1dE1DNnUX-z5gcg9neIBGrjA5JCKguiwwXukkaoBwAF1YzxHQHUVgw/exec',
  REQUEST_TIMEOUT_MS: 15000,
};

// ===== 獎項靜態資料（順序、數量與後端 C 分頁一致，共 167 份）=====
const PRIZES = [
  { name: '🍧 刨冰獎', emoji: '🍧', content: '【SPICE】掛脖式風扇', type: '實物贈品', typeClass: 'physical', qty: 3 },
  { name: '🍵 抹茶獎', emoji: '🍵', content: '【SKATER】胖胖水壺530ml', type: '實物贈品', typeClass: 'physical', qty: 8 },
  { name: '🍡 糰子獎', emoji: '🍡', content: '【MASCLUB】3D涼感口罩10枚入×3包', type: '實物贈品', typeClass: 'physical', qty: 22 },
  { name: '🧊 冰沙獎', emoji: '🧊', content: '運費折抵券1張【抵扣1箱運費】', type: '運費抵扣券', typeClass: 'shipping', qty: 30 },
  { name: '🥤 蘇打獎', emoji: '🥤', content: '本次訂單折 NT$100', type: '本次訂單折扣', typeClass: 'discount', qty: 45 },
  { name: '🫧 彈珠汽水獎', emoji: '🫧', content: '本次訂單折 NT$50', type: '本次訂單折扣', typeClass: 'discount', qty: 59 },
];

// ===== 獎品類型對應說明文案 =====
const TYPE_NOTES = {
  '實物贈品': '🎁 贈品將隨您的訂單一併寄出',
  '本次訂單折扣': '💡 此折扣將在本次訂單結帳時直接扣抵',
  '運費抵扣券': '📦 此券可抵扣1箱運費（上限NT$130），限單筆訂單使用1張',
};
