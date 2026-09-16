const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { buildPrompt, buildRefinePrompt } = require('../.test-build/prompt.js');

const source = fs.readFileSync(path.join(__dirname, '../production-recovery/lib/prompt.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const recovered = { exports: {} };
vm.runInNewContext(compiled, { exports: recovered.exports, module: recovered });

test('generation text exactly matches the recovered production prompt', () => {
  const input = { targetShop: 'THUNDER TOPUP', referenceShop: 'THUNDER TOPUP', aspectRatio: '4:5' };
  assert.equal(buildPrompt(input), recovered.exports.buildPrompt(input));
});

test('refine text exactly matches the recovered production prompt', () => {
  const input = { targetShop: 'THUNDER TOPUP', referenceShop: 'THUNDER TOPUP', aspectRatio: '1:1', editInstruction: 'Increase price size' };
  assert.equal(buildRefinePrompt(input), recovered.exports.buildRefinePrompt(input));
});

test('current API without referenceShop defaults to the target shop', () => {
  const input = { targetShop: 'THUNDER TOPUP', aspectRatio: '3:4' };
  assert.equal(buildPrompt(input), recovered.exports.buildPrompt({ ...input, referenceShop: input.targetShop }));
  assert.ok(!buildPrompt(input).includes('undefined'));
  assert.equal(buildRefinePrompt({ editInstruction: 'Adjust spacing' }), recovered.exports.buildRefinePrompt({ editInstruction: 'Adjust spacing' }));
});

test('later brand and footer instructions are not appended', () => {
  const input = { targetShop: 'THUNDER TOPUP', aspectRatio: '1:1' };
  const specialFeature = { enabled: true, styles: ['full-brand', 'logo-qr'], note: 'Later instruction' };
  assert.equal(buildPrompt({ ...input, specialFeature }), buildPrompt(input));
  assert.equal(buildRefinePrompt({ ...input, editInstruction: 'Edit', specialFeature }), buildRefinePrompt({ ...input, editInstruction: 'Edit' }));
});
