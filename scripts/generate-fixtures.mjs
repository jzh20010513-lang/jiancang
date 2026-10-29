import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// All holdings below are invented. Re-running this file produces the same pixels.
const out = resolve('artifacts/ocr-fixtures');
await mkdir(out, { recursive: true });
const conditions = ['clean', 'large', 'small', 'lowContrast', 'dark', 'blur', 'overlap', 'truncated', 'multiCurrency', 'decimals', 'compact', 'noisy'];
const fixtures = [];
for (const layout of ['table', 'card', 'stacked']) {
  for (const condition of conditions) {
    const rows = [
      { name: '青岚成长组合', marketValue: 12345.67, currency: 'CNY' },
      { name: '星河稳健组合', marketValue: 8096.25, currency: condition === 'multiCurrency' ? 'USD' : 'CNY' },
      { name: '云杉精选组合', marketValue: 25780.5, currency: condition === 'multiCurrency' ? 'HKD' : 'CNY' },
    ];
    if (condition === 'decimals') rows.forEach((r, i) => { r.marketValue = [0.58, 1000000.01, 999.9][i]; });
    fixtures.push({ id: `${layout}-${condition}`, file: `${layout}-${condition}.png`, layout, condition, width: layout === 'table' ? 1200 : 800, height: layout === 'card' ? 1040 : 740, rows });
  }
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body><canvas></canvas></body></html>');
  for (const fixture of fixtures) {
    const data = await page.evaluate(async f => {
      await document.fonts.ready;
      const canvas = document.querySelector('canvas');
      canvas.width = f.width; canvas.height = f.height;
      const ctx = canvas.getContext('2d');
      const dark = f.condition === 'dark';
      const fg = dark ? '#f2f5f9' : f.condition === 'lowContrast' ? '#8c959f' : '#172432';
      const bg = dark ? '#172432' : '#f5f7fa';
      ctx.fillStyle = bg; ctx.fillRect(0, 0, f.width, f.height);
      ctx.fillStyle = fg; ctx.font = 'bold 32px "Microsoft YaHei", sans-serif';
      ctx.fillText('合成持仓识别评估', 36, 58);
      ctx.font = '18px "Microsoft YaHei", sans-serif'; ctx.fillText('仅为测试生成 · 虚构资产', 36, 94);
      const size = f.condition === 'large' ? 34 : f.condition === 'small' ? 20 : 28;
      const text = (s, x, y, bold = false) => { ctx.fillStyle = fg; ctx.font = `${bold ? 'bold ' : ''}${size}px "Microsoft YaHei", sans-serif`; ctx.fillText(s, x, y); };
      const money = r => `${r.currency} ${r.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      f.rows.forEach((r, i) => {
        if (f.layout === 'table') {
          if (i === 0) { text('资产名称', 40, 158, true); text('持仓金额', 650, 158, true); }
          const y = 248 + i * (f.condition === 'compact' ? 70 : 130);
          text(r.name, 40, y); text(money(r), 650, y, true);
          ctx.strokeStyle = dark ? '#3e4b58' : '#d9e0e7'; ctx.beginPath(); ctx.moveTo(40, y + 34); ctx.lineTo(1150, y + 34); ctx.stroke();
        } else if (f.layout === 'card') {
          const top = 132 + i * (f.condition === 'compact' ? 238 : 280);
          ctx.fillStyle = dark ? '#233343' : '#ffffff'; ctx.fillRect(28, top, 744, 244);
          text(r.name, 56, top + 56, true); text('持仓金额', 56, top + 112); text(money(r), 56, top + 176, true);
        } else {
          const y = 174 + i * (f.condition === 'compact' ? 138 : 176);
          text(r.name, 40, y, true); text(`持仓金额 ${money(r)}`, 40, y + 58);
        }
      });
      if (f.condition === 'truncated') {
        // Mask only the end of the name column; amounts remain visible.
        ctx.fillStyle = bg;
        if (f.layout === 'table') ctx.fillRect(148, 190, 288, 420);
        else f.rows.forEach((_, i) => ctx.fillRect(f.layout === 'card' ? 164 : 148, (f.layout === 'card' ? 132 + i * 280 + 20 : 174 + i * 176 - 32), 310, 42));
      }
      if (f.condition === 'overlap') {
        ctx.save(); ctx.globalAlpha = .72; ctx.fillStyle = dark ? '#e1a657' : '#b54030'; ctx.font = 'bold 40px "Microsoft YaHei", sans-serif';
        ctx.translate(f.layout === 'table' ? 610 : 180, 310); ctx.rotate(-.12); ctx.fillText('示例水印', 0, 0); ctx.restore();
      }
      if (f.condition === 'noisy') {
        let seed = 20261026;
        for (let j = 0; j < 3500; j++) { seed = (1664525 * seed + 1013904223) >>> 0; const x = seed % f.width; seed = (1664525 * seed + 1013904223) >>> 0; const y = seed % f.height; ctx.fillStyle = j % 2 ? '#ffffff55' : '#32445544'; ctx.fillRect(x, y, 1, 1); }
      }
      if (f.condition === 'blur') {
        const copy = document.createElement('canvas'); copy.width = f.width; copy.height = f.height; copy.getContext('2d').drawImage(canvas, 0, 0);
        ctx.filter = 'blur(1px)'; ctx.drawImage(copy, 0, 0); ctx.filter = 'none';
      }
      return canvas.toDataURL('image/png').split(',')[1];
    }, fixture);
    await writeFile(resolve(out, fixture.file), Buffer.from(data, 'base64'));
  }
  await writeFile(resolve(out, 'groundtruth.json'), JSON.stringify({ schemaVersion: 1, synthetic: true, seed: 20261026, description: 'Generic invented layouts; no claim of compatibility with any financial platform.', fixtures }, null, 2));
  console.log(`Generated ${fixtures.length} synthetic screenshots in ${out}`);
} finally { await browser.close(); }
