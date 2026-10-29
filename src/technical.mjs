/**
 * Pure, local technical indicators for ordered validated daily OHLCV bars.
 * Dates must be real YYYY-MM-DD values in strictly increasing order; gaps are
 * allowed. Windows count observations, not calendar days. Inputs are not mutated.
 *
 * MA(N): arithmetic mean of the latest N closes, available after N bars.
 * RSI(14): mean gains/losses of the first 14 changes, then Wilder smoothing
 * average <- average + (change - average)/14. Available after 15 bars.
 * Flat series -> 50; gains without losses -> 100; losses without gains -> 0.
 * MACD: EMA12 - EMA26 (DIF), EMA9(DIF) (DEA), 2*(DIF-DEA) histogram.
 * Each EMA uses alpha=2/(period+1), seeded at the first close (DEA at 0).
 * MACD is shown only after 60 bars, although seeded from all supplied history.
 * Volume ratio: last volume / arithmetic mean of the preceding 20 volumes;
 * all 21 must be known, finite and nonnegative, with a positive prior mean.
 * Return20: (last close / close 20 observations earlier - 1)*100 (21 bars).
 * Max drawdown20: minimum (close/running peak - 1)*100 inside the final 20
 * closes (20 bars), a nonpositive percentage. Peaks precede their troughs.
 * Insufficient history or a nonfinite calculated result is represented by null.
 */
export function technicalAnalysis(points) {
  if (!Array.isArray(points)) throw new TypeError('points must be an array');
  let previousDate = null;
  for (const point of points) {
    if (!point || !Number.isFinite(point.close) || point.close <= 0) {
      throw new TypeError('Each close must be a finite positive number');
    }
    const date = point.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new TypeError('Each date must be YYYY-MM-DD');
    }
    const timestamp = Date.parse(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
      throw new TypeError('Each date must be a real calendar date');
    }
    if (previousDate !== null && date <= previousDate) {
      throw new TypeError('Dates must be in strictly increasing order');
    }
    previousDate = date;
  }

  const count = points.length;
  const closes = points.map(point => point.close);
  const finite = value => Number.isFinite(value) ? value : null;
  // Incremental mean avoids overflowing the sum of finite positive observations.
  const mean = values => values.reduce((average, value, index) => average + (value - average) / (index + 1), 0);
  const movingAverage = period => count >= period ? finite(mean(closes.slice(-period))) : null;
  let rsi14 = null;
  if (count >= 15) {
    const gains = [];
    const losses = [];
    for (let index = 1; index <= 14; index++) {
      const change = closes[index] - closes[index - 1];
      gains.push(Math.max(change, 0));
      losses.push(Math.max(-change, 0));
    }
    let gain = mean(gains);
    let loss = mean(losses);
    for (let index = 15; index < count; index++) {
      const change = closes[index] - closes[index - 1];
      gain += (Math.max(change, 0) - gain) / 14;
      loss += (Math.max(-change, 0) - loss) / 14;
    }
    const scale = Math.max(gain, loss);
    rsi14 = scale === 0 ? 50 : finite(100 * (gain / scale) / (gain / scale + loss / scale));
  }

  let macd = null;
  if (count >= 60) {
    let fast = closes[0];
    let slow = closes[0];
    let dif = 0;
    let dea = 0;
    for (let index = 1; index < count; index++) {
      fast += (closes[index] - fast) * (2 / 13);
      slow += (closes[index] - slow) * (2 / 27);
      dif = fast - slow;
      dea += (dif - dea) * (2 / 10);
    }
    const histogram = 2 * (dif - dea);
    if ([dif, dea, histogram].every(Number.isFinite)) macd = { dif, dea, histogram };
  }

  let volumeRatio20 = null;
  if (count >= 21) {
    const volumes = points.slice(-21).map(point => point.volume);
    if (volumes.every(value => Number.isFinite(value) && value >= 0)) {
      const baseline = mean(volumes.slice(0, 20));
      if (baseline > 0) volumeRatio20 = finite(volumes[20] / baseline);
    }
  }

  let maxDrawdown20 = null;
  if (count >= 20) {
    let peak = closes[count - 20];
    let drawdown = 0;
    for (const close of closes.slice(-20)) {
      peak = Math.max(peak, close);
      drawdown = Math.min(drawdown, (close / peak - 1) * 100);
    }
    maxDrawdown20 = finite(drawdown);
  }

  return {
    sampleCount: count,
    lastDate: count ? points[count - 1].date : null,
    lastClose: count ? closes[count - 1] : null,
    ma20: movingAverage(20),
    ma60: movingAverage(60),
    rsi14,
    macd,
    volumeRatio20,
    return20: count >= 21 ? finite((closes[count - 1] / closes[count - 21] - 1) * 100) : null,
    maxDrawdown20,
  };
}
