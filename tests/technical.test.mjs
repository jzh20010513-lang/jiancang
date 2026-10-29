import test from 'node:test';
import assert from 'node:assert/strict';

import { technicalAnalysis as analyze } from '../src/technical.mjs';
function bars(closes, volumes = closes.map(() => 100)) {
  return closes.map((close, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    open: close, high: close, low: close, close, volume: volumes[index],
  }));
}
const near = (actual, expected, tolerance = 1e-10) => assert.ok(
  typeof actual === 'number' && Math.abs(actual - expected) <= tolerance,
  `${actual} should be within ${tolerance} of ${expected}`,
);

test('empty and short history expose unavailable indicators as null', () => {
  assert.deepEqual(analyze([]), {
    sampleCount: 0, lastDate: null, lastClose: null, ma20: null, ma60: null,
    rsi14: null, macd: null, volumeRatio20: null, return20: null, maxDrawdown20: null,
  });
  const result = analyze(bars([10, 11, 12]));
  assert.equal(result.sampleCount, 3);
  assert.equal(result.lastDate, '2026-01-03');
  assert.equal(result.lastClose, 12);
  for (const name of ['ma20', 'ma60', 'rsi14', 'macd', 'volumeRatio20', 'return20', 'maxDrawdown20']) {
    assert.equal(result[name], null, name);
  }
});

test('moving averages use only final windows at exact 20 and 60 thresholds', () => {
  assert.equal(analyze(bars(Array(19).fill(8))).ma20, null);
  assert.equal(analyze(bars(Array(20).fill(8))).ma20, 8);
  assert.equal(analyze(bars(Array(59).fill(8))).ma60, null);
  assert.equal(analyze(bars(Array(60).fill(8))).ma60, 8);
  const result = analyze(bars(Array.from({ length: 61 }, (_, index) => index + 1)));
  near(result.ma20, 51.5); // 42..61
  near(result.ma60, 31.5); // 2..61
  near(result.return20, 48.78048780487805); // 61 / 41 - 1
  assert.equal(result.maxDrawdown20, 0);
  assert.equal(result.rsi14, 100);
});

test('RSI handles downward and flat prices and requires fourteen changes', () => {
  assert.equal(analyze(bars(Array(14).fill(10))).rsi14, null);
  assert.equal(analyze(bars(Array(15).fill(10))).rsi14, 50);
  assert.equal(analyze(bars(Array.from({ length: 15 }, (_, index) => 20 - index))).rsi14, 0);
});

test('RSI uses Wilder smoothing after the initial arithmetic gain/loss mean', () => {
  // First 14 changes: seven +2 and seven -1 => RSI 66 2/3.
  const closes = [100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105, 107, 106, 108, 107];
  near(analyze(bars(closes)).rsi14, 66.66666666666667);
  // New +1: gains = 1, losses = 6.5/14, RSI = 100 * 14/20.5.
  near(analyze(bars([...closes, 108])).rsi14, 68.29268292682927);
});

test('MACD waits for sixty bars and seeds both EMAs from first close', () => {
  assert.equal(analyze(bars(Array(59).fill(10))).macd, null);
  assert.deepEqual(analyze(bars(Array(60).fill(10))).macd, { dif: 0, dea: 0, histogram: 0 });
  // 59 flat bars followed by +10: DIF = 10*(2/13-2/27), DEA = DIF/5.
  const result = analyze(bars([...Array(59).fill(100), 110]));
  near(result.macd.dif, 0.7977207977207977);
  near(result.macd.dea, 0.15954415954415954);
  near(result.macd.histogram, 1.2763532763532763);
  // A first-bar impulse distinguishes first-close seeding from SMA seeding.
  // DIF = 10*((11/13)^59-(25/27)^59); DEA follows a geometric-series sum.
  const seeded = analyze(bars([110, ...Array(59).fill(100)])).macd;
  near(seeded.dif, -0.10613500918514865);
  near(seeded.dea, -0.15497174394443494);
  near(seeded.histogram, 0.09767346951857259);
});

test('volume ratio excludes current bar and refuses unknown or zero baselines', () => {
  const closes = Array(21).fill(10);
  near(analyze(bars(closes, [...Array(20).fill(100), 250])).volumeRatio20, 2.5);
  assert.equal(analyze(bars(closes.slice(1))).volumeRatio20, null);
  assert.equal(analyze(bars(closes, [...Array(20).fill(100), null])).volumeRatio20, null);
  assert.equal(analyze(bars(closes, [null, ...Array(20).fill(100)])).volumeRatio20, null);
  assert.equal(analyze(bars(closes, [...Array(20).fill(0), 100])).volumeRatio20, null);
  near(analyze(bars(Array(22).fill(10), [null, ...Array(20).fill(100), 200])).volumeRatio20, 2);
});

test('return uses twenty intervals and drawdown respects temporal peaks in final twenty closes', () => {
  assert.equal(analyze(bars(Array(20).fill(10))).return20, null);
  const result = analyze(bars([1000, ...Array(15).fill(100), 120, 90, 110, 60, 100]));
  near(result.return20, -90);
  near(result.maxDrawdown20, -50); // 120 -> 60; first 1000 excluded.
  near(analyze(bars(Array.from({ length: 20 }, (_, index) => 20 - index))).maxDrawdown20, -95);
});

test('rejects invalid close prices, invalid dates, duplicates and descending dates', () => {
  for (const close of [0, -1, NaN, Infinity, '10', null]) {
    assert.throws(() => analyze(bars([close])), /close/i);
  }
  for (const date of ['', '2026-02-30', 'not-a-date']) {
    assert.throws(() => analyze([{ ...bars([10])[0], date }]), /date/i);
  }
  const points = bars([10, 11]);
  assert.throws(() => analyze([points[0], points[0]]), /order|date/i);
  assert.throws(() => analyze(points.toReversed()), /order|date/i);
  assert.throws(() => analyze(null), /array/i);
});

test('finite extreme inputs never expose NaN or infinity and preserve representable means', () => {
  const points = bars([...Array(59).fill(Number.MAX_VALUE), Number.MIN_VALUE]);
  const result = analyze(points);
  assert.ok(result.ma20 > 0 && Number.isFinite(result.ma20));
  assert.ok(result.ma60 > 0 && Number.isFinite(result.ma60));
  const overflow = analyze(bars([Number.MIN_VALUE, ...Array(20).fill(Number.MAX_VALUE)]));
  assert.equal(overflow.return20, null);
  for (const value of Object.values(result)) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    else if (value && typeof value === 'object') {
      for (const part of Object.values(value)) assert.ok(part === null || Number.isFinite(part));
    }
  }
});
