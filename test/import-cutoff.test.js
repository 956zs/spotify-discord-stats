import assert from 'node:assert/strict';
import test from 'node:test';
import { describeImportCutoff, resolveImportCutoff } from '../shared/import-cutoff.js';

test('first synced play becomes the default cutoff', () => {
  assert.deepEqual(resolveImportCutoff({}, '2026-07-05T13:02:33.723Z'), {
    before: '2026-07-05T13:02:33.723Z',
    reason: 'first_synced_play'
  });
});

test('an explicit --before wins over the first synced play', () => {
  assert.deepEqual(resolveImportCutoff({ before: '2026-01-01T00:00:00.000Z' }, '2026-07-05T13:02:33.723Z'), {
    before: '2026-01-01T00:00:00.000Z',
    reason: 'flag'
  });
});

test('--no-cutoff imports everything', () => {
  assert.deepEqual(resolveImportCutoff({ noCutoff: true }, '2026-07-05T13:02:33.723Z'), {
    before: null,
    reason: 'disabled'
  });
});

test('no synced plays means no cutoff', () => {
  for (const empty of [null, undefined, '']) {
    assert.deepEqual(resolveImportCutoff({}, empty), { before: null, reason: 'no_synced_plays' });
  }
});

test('first synced play time is normalized to ISO', () => {
  assert.equal(resolveImportCutoff({}, '2026-07-05T21:02:33+08:00').before, '2026-07-05T13:02:33.000Z');
});

test('an unreadable first synced play time is an error', () => {
  assert.throws(() => resolveImportCutoff({}, 'not a date'), /Invalid first synced play time/);
});

test('each cutoff reason has a readable description', () => {
  assert.match(describeImportCutoff({ before: '2026-01-01T00:00:00.000Z', reason: 'flag' }), /--before/);
  assert.match(describeImportCutoff({ before: '2026-01-01T00:00:00.000Z', reason: 'first_synced_play' }), /--no-cutoff/);
  assert.match(describeImportCutoff({ before: null, reason: 'disabled' }), /every play/);
  assert.match(describeImportCutoff({ before: null, reason: 'no_synced_plays' }), /No synced plays/);
});
