import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync(
  new URL(
    '../../src/app/home/components/event-patterns/event-pattern-groups.ts',
    import.meta.url,
  ),
  'utf8',
);
const exports = {};
new Function(
  'exports',
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(exports);

for (const [supported, required, covered] of [
  ['message.received', 'message.received', true],
  ['message.received', 'group.member_joined', false],
  ['message.received', 'message.*', false],
  ['message.received', '*', false],
  ['group.*', 'group.member_joined', true],
  ['group.*', 'group.*', true],
  ['group.*', 'groupish.member_joined', false],
  ['group.*', '*', false],
  ['*', 'group.*', true],
  ['*', '*', true],
]) {
  test(`${supported} ${covered ? 'covers' : 'does not cover'} ${required}`, () => {
    assert.equal(exports.eventPatternCovers(supported, required), covered);
  });
}
