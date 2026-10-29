import test from 'node:test';
import assert from 'node:assert/strict';
import {formatDecimal} from '../src/format.mjs';
test('display preserves exact large decimals rather than rounding across integer boundary',()=>{
 assert.equal(formatDecimal('999999999999999.99'),'999,999,999,999,999.99');
 assert.equal(formatDecimal('-12345.12345678'),'-12,345.12345678');
 assert.equal(formatDecimal('0'),'0.00');assert.equal(formatDecimal('0.1'),'0.10');
});
