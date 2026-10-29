import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
test('vendor output preserves upstream model and embedded worker license notices',async()=>{
 execFileSync(process.execPath,['scripts/vendor.mjs']);
 const notice=await readFile('public/vendor/THIRD_PARTY.txt','utf8');
 const embedded=await readFile('node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt','utf8');
 assert.ok(notice.includes(embedded),'embedded worker license notices must not be discarded');
 assert.match(notice,/naptha\/tessdata.*Apache-2.0/);
 assert.match(notice,/tesseract-ocr\/tessdata_best/);
 assert.match(notice,/regenerator-runtime/);
 assert.match(notice,/wasm-feature-detect/);
 assert.match(notice,/Independent JPEG Group/);
 assert.match(notice,/leptonica/);
 assert.match(notice,/openlibm/);
});
