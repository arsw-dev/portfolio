import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFlag } from './env.ts';

describe('parseFlag', () => {
  it('treats unset, empty, 0 and false as off', () => {
    for (const raw of [undefined, '', '0', 'false', 'FALSE', ' false ']) {
      assert.equal(parseFlag('DRY_RUN', raw), false, String(raw));
    }
  });

  it('treats 1 and true as on', () => {
    for (const raw of ['1', 'true', 'True']) {
      assert.equal(parseFlag('DRY_RUN', raw), true, raw);
    }
  });

  it('rejects anything else instead of guessing', () => {
    assert.throws(() => parseFlag('DRY_RUN', 'yes'), /DRY_RUN must be 1\/true or 0\/false, got "yes"/);
  });
});
