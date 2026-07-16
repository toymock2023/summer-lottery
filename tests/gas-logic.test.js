'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Code.gs 是合法 JS（GAS V8），以 new Function 載入並取出純函式
const source = fs.readFileSync(path.join(__dirname, '..', 'gas', 'Code.gs'), 'utf8');
const gas = new Function(source + '\nreturn { calcTotalDraws, pickPrize, normalizeId, formatMoney, checkActivityPeriod };')();

test('calcTotalDraws：每滿 2000 抽 1 次', () => {
  assert.strictEqual(gas.calcTotalDraws(1999), 0);
  assert.strictEqual(gas.calcTotalDraws(2000), 1);
  assert.strictEqual(gas.calcTotalDraws(9500), 4);
  assert.strictEqual(gas.calcTotalDraws(0), 0);
  assert.strictEqual(gas.calcTotalDraws('abc'), 0);
  assert.strictEqual(gas.calcTotalDraws(-100), 0);
});

test('pickPrize：依剩餘數量加權抽取', () => {
  const pool = [
    { name: 'A', remaining: 1 },
    { name: 'B', remaining: 2 },
    { name: 'C', remaining: 0 },
  ];
  // total=3；rand→r=Math.floor(rand()*3)：0→A、1→B、2→B
  assert.strictEqual(gas.pickPrize(pool, () => 0).name, 'A');
  assert.strictEqual(gas.pickPrize(pool, () => 0.34).name, 'B');
  assert.strictEqual(gas.pickPrize(pool, () => 0.99).name, 'B');
});

test('pickPrize：跳過剩餘 0 的獎項', () => {
  const pool = [{ name: 'A', remaining: 0 }, { name: 'B', remaining: 5 }];
  for (const r of [0, 0.2, 0.5, 0.99]) {
    assert.strictEqual(gas.pickPrize(pool, () => r).name, 'B');
  }
});

test('pickPrize：獎池全空回傳 null', () => {
  assert.strictEqual(gas.pickPrize([{ name: 'A', remaining: 0 }], () => 0.5), null);
  assert.strictEqual(gas.pickPrize([], () => 0.5), null);
});

test('normalizeId：去空白並轉大寫', () => {
  assert.strictEqual(gas.normalizeId('  c001 '), 'C001');
  assert.strictEqual(gas.normalizeId('ord-20260716-001'), 'ORD-20260716-001');
  assert.strictEqual(gas.normalizeId(null), '');
  assert.strictEqual(gas.normalizeId(undefined), '');
});

test('formatMoney：手動千分位格式化（不依賴 toLocaleString）', () => {
  assert.strictEqual(gas.formatMoney(9500), '9,500');
  assert.strictEqual(gas.formatMoney(3000), '3,000');
  assert.strictEqual(gas.formatMoney(0), '0');
  assert.strictEqual(gas.formatMoney(1234567), '1,234,567');
  assert.strictEqual(gas.formatMoney(999), '999');
});

test('checkActivityPeriod：活動期間判斷', () => {
  assert.strictEqual(gas.checkActivityPeriod(new Date('2026-07-01T00:00:00+08:00')), 'NOT_STARTED');
  assert.strictEqual(gas.checkActivityPeriod(new Date('2026-07-16T23:59:59+08:00')), 'NOT_STARTED');
  assert.strictEqual(gas.checkActivityPeriod(new Date('2026-07-17T00:00:00+08:00')), 'ACTIVE');
  assert.strictEqual(gas.checkActivityPeriod(new Date('2026-08-01T12:00:00+08:00')), 'ACTIVE');
  assert.strictEqual(gas.checkActivityPeriod(new Date('2026-08-14T23:59:59+08:00')), 'ACTIVE');
  assert.strictEqual(gas.checkActivityPeriod(new Date('2026-08-15T00:00:01+08:00')), 'ENDED');
});
