import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { parseAmount } from '../src/domain.mjs';

const origin = process.env.OCR_TEST_URL || 'http://127.0.0.1:4319';
const fixtureRoot = resolve('artifacts/ocr-fixtures');
const truth = JSON.parse(await readFile(resolve(fixtureRoot, 'groundtruth.json'), 'utf8'));
const requested = process.env.OCR_CASES?.split(',').filter(Boolean);
const fixtures = truth.fixtures.filter(f => !requested || requested.includes(f.id));
if (!fixtures.length) throw new Error('No fixture matched OCR_CASES');
await mkdir(resolve('artifacts'), { recursive: true });
const rescoreOnly = process.argv.includes('--rescore');
const report = rescoreOnly ? JSON.parse(await readFile(resolve('artifacts/ocr-results.json'), 'utf8')) : { schemaVersion: 1, synthetic: true, startedAt: new Date().toISOString(), origin, matching: 'Raw predicted fields matched as multisets; no correction, truth substitution, default currency, or fabricated OCR.', browserErrors: [], cases: [] };
report.amountTolerance = 0;
report.amountMatching = 'Strict equality after parseAmount decimal normalization; null is never a match.';
const sourceHash = async () => createHash('sha256').update(await readFile(resolve('src/ocr.mjs'))).digest('hex');
if (!rescoreOnly) {
  report.ocrSourceSha256 = await sourceHash();
  report.fixtureGroundtruthSha256 = createHash('sha256').update(await readFile(resolve(fixtureRoot, 'groundtruth.json'))).digest('hex');
}
const normalizedName = value => String(value ?? '').replace(/\s+/gu, '');
const amountEqual = (a, b) => { const parsed = parseAmount(String(a)); return parsed !== null && parsed === parseAmount(String(b)); };
function matchingCount(predictions, expected, same) {
  const remaining = expected.slice(); let correct = 0;
  for (const row of predictions) { const i = remaining.findIndex(other => same(row, other)); if (i >= 0) { correct++; remaining.splice(i, 1); } }
  return correct;
}
const score = (correct, predicted, expected) => ({ correct, predicted, expected, precision: predicted ? correct / predicted : 0, recall: expected ? correct / expected : 0 });
function metrics(predictions, expected) {
  return {
    amount: score(matchingCount(predictions, expected, (a,b) => amountEqual(a.marketValue,b.marketValue)), predictions.length, expected.length),
    currency: score(matchingCount(predictions, expected, (a,b) => a.currency === b.currency), predictions.length, expected.length),
    amountCurrency: score(matchingCount(predictions, expected, (a,b) => amountEqual(a.marketValue,b.marketValue) && a.currency === b.currency), predictions.length, expected.length),
    name: score(matchingCount(predictions, expected, (a,b) => normalizedName(a.name) === normalizedName(b.name)), predictions.length, expected.length),
    completeRow: score(matchingCount(predictions, expected, (a,b) => amountEqual(a.marketValue,b.marketValue) && a.currency === b.currency && normalizedName(a.name) === normalizedName(b.name)), predictions.length, expected.length),
  };
}
const save = async () => { await writeFile(resolve('artifacts/ocr-results.json'), JSON.stringify(report, null, 2)); };
function summarize() {
  report.summary = {};
  for (const field of ['amount','currency','amountCurrency','name','completeRow']) {
    const totals = report.cases.reduce((a,c) => { const m=c.metrics[field]; a.correct+=m.correct;a.predicted+=m.predicted;a.expected+=m.expected;return a; }, {correct:0,predicted:0,expected:0});
    report.summary[field] = score(totals.correct, totals.predicted, totals.expected);
  }
  report.summary.caseCount = report.cases.length;
  report.summary.errorCount = report.cases.filter(c => c.error).length;
  report.summary.failedCases = report.cases.filter(c => c.error || c.metrics.completeRow.recall < 1 || c.metrics.completeRow.precision < 1).map(c => c.id);
  report.summary.recognitionMs = report.cases.reduce((sum,c) => sum+(c.recognitionMs||0),0);
}
if (rescoreOnly) {
  const originalOutputs = JSON.stringify(report.cases.map(({rawResult,predictions,expected,recognitionMs,totalMs}) => ({rawResult,predictions,expected,recognitionMs,totalMs})));
  for (const item of report.cases) item.metrics = metrics(item.predictions, item.expected);
  summarize();
  if (originalOutputs !== JSON.stringify(report.cases.map(({rawResult,predictions,expected,recognitionMs,totalMs}) => ({rawResult,predictions,expected,recognitionMs,totalMs})))) throw new Error('Rescoring changed original OCR evidence');
  report.rescoring = { method: 'rescored exact decimal', at: new Date().toISOString(), recognitionRerun: false, originalRawOutputsPredictionsTruthAndTimingPreserved: true };
  await save();
  console.log(JSON.stringify(report.summary, null, 2));
  process.exit(report.summary.errorCount ? 1 : 0);
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', error => report.browserErrors.push({ kind: 'pageerror', message: String(error) }));
  page.on('requestfailed', request => report.browserErrors.push({ kind: 'requestfailed', url: request.url(), message: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) report.browserErrors.push({ kind: 'http', url: response.url(), status: response.status() }); });
  await page.goto(`${origin}/tests/ocr-harness.html`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { window.ocrModule = await import('/src/ocr.mjs'); if (typeof window.ocrModule.startRecognition !== 'function') throw new Error('Missing startRecognition export'); });
  for (const f of fixtures) {
    const image = (await readFile(resolve(fixtureRoot, f.file))).toString('base64');
    const started = performance.now();
    let output;
    try {
      output = await page.evaluate(async ({ image }) => {
        const source = new Image(); source.src = `data:image/png;base64,${image}`; await source.decode();
        const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height; canvas.getContext('2d').drawImage(source, 0, 0);
        const progress = []; const before = performance.memory?.usedJSHeapSize ?? null; const start = performance.now();
        const result = await window.ocrModule.startRecognition(canvas, item => { progress.push(item); });
        return { result, recognitionMs: performance.now() - start, heapBeforeBytes: before, heapAfterBytes: performance.memory?.usedJSHeapSize ?? null, progress };
      }, { image });
      if (!Array.isArray(output.result?.rows)) throw new Error('startRecognition did not return rows array');
      report.cases.push({ id: f.id, layout: f.layout, condition: f.condition, expected: f.rows, rawResult: output.result, predictions: output.result.rows, metrics: metrics(output.result.rows, f.rows), recognitionMs: output.recognitionMs, totalMs: performance.now() - started, heapBeforeBytes: output.heapBeforeBytes, heapAfterBytes: output.heapAfterBytes, progress: output.progress });
    } catch (error) {
      report.cases.push({ id: f.id, layout: f.layout, condition: f.condition, expected: f.rows, error: String(error.stack || error), rawResult: output?.result ?? null, predictions: [], metrics: metrics([], f.rows), totalMs: performance.now() - started });
    }
    await save();
    const last = report.cases.at(-1); console.log(`${f.id}: ${last.error ? 'ERROR' : `${last.metrics.amountCurrency.correct}/${f.rows.length} amount+currency`} (${Math.round(last.totalMs)}ms)`);
  }
} finally {
  report.completedAt = new Date().toISOString();
  report.ocrSourceSha256AtEnd = await sourceHash();
  report.sourceUnchangedDuringRun = report.ocrSourceSha256 === report.ocrSourceSha256AtEnd;
  summarize();
  await save(); await browser.close();
}
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.errorCount) process.exitCode = 1;
