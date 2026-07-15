'use strict';

// ===== 部署設定 =====
// 部署 GAS Web App 後，將取得的 URL 貼入 API_URL，例如：
// https://script.google.com/macros/s/XXXXXXXX/exec
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxgIIcPr2mCTp7P1dE1DNnUX-z5gcg9neIBGrjA5JCKguiwwXukkaoBwAF1YzxHQHUVgw/exec',
  REQUEST_TIMEOUT_MS: 15000,
};

// ===== 獎項靜態資料（順序、數量與後端 C 分頁一致，共 122 份）=====
const PRIZES = [
  { name: '🍧 刨冰獎', emoji: '🍧', content: '【SPICE】掛脖式風扇', type: '實物贈品', typeClass: 'physical', qty: 3 },
  { name: '🍵 抹茶獎', emoji: '🍵', content: '【SKATER】胖胖水壺530ml', type: '實物贈品', typeClass: 'physical', qty: 8 },
  { name: '🍡 糰子獎', emoji: '🍡', content: '【MASCLUB】3D涼感口罩10枚入×3包', type: '實物贈品', typeClass: 'physical', qty: 22 },
  { name: '🥤 蘇打獎', emoji: '🥤', content: '下筆訂單折 NT$100', type: '下筆訂單折扣', typeClass: 'discount', qty: 30 },
  { name: '🫧 彈珠汽水獎', emoji: '🫧', content: '下筆訂單折 NT$50', type: '下筆訂單折扣', typeClass: 'discount', qty: 59 },
];

// ===== 獎品類型對應說明文案 =====
const TYPE_NOTES = {
  '實物贈品': '🎁 贈品將隨您的下一筆訂單一併寄出',
  '下筆訂單折扣': '💡 此折扣將於您下一筆訂單結帳時直接扣抵',
};
