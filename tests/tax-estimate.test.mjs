import test from 'node:test';
import assert from 'node:assert/strict';
import { moroccoIncomeTax, moroccoAutoEntrepreneur } from '../src/utils/tax-estimate.js';

test('Morocco income tax: exempt band, brackets, continuity at the limits', () => {
  assert.equal(moroccoIncomeTax(35000).tax, 0);
  assert.equal(moroccoIncomeTax(40000).tax, 0);
  assert.equal(moroccoIncomeTax(60000).tax, 2000); // 60 000 × 10 % − 4 000
  assert.equal(moroccoIncomeTax(80000).tax, 6000); // continuous with the next bracket
  assert.equal(moroccoIncomeTax(100000).tax, 12000);
  assert.equal(moroccoIncomeTax(180000).tax, 39200);
  assert.equal(moroccoIncomeTax(200000).tax, 46600); // 200 000 × 37 % − 27 400
  assert.equal(moroccoIncomeTax(200000).marginalRate, 0.37);
});

test('auto-entrepreneur: flat share of turnover and ceiling warning', () => {
  assert.equal(moroccoAutoEntrepreneur(150000, 'services').tax, 1500);
  assert.equal(moroccoAutoEntrepreneur(250000, 'services').overCeiling, true);
  assert.equal(moroccoAutoEntrepreneur(250000, 'commerce').tax, 1250);
});
