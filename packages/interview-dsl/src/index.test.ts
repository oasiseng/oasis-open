import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextStepId, path, END } from './index.ts';
import { EXAMPLE } from './example.ts';

describe('interview-dsl', () => {
  it('a letter path skips the design steps', () => {
    assert.deepEqual(path(EXAMPLE, { need: 'letter' }), ['need', 'letter.who', 'letter.visible', 'contact', 'address', 'story', 'files', 'review']);
  });
  it('a design path skips the letter steps', () => {
    assert.deepEqual(path(EXAMPLE, { need: 'design' }), ['need', 'design.what', 'contact', 'address', 'story', 'files', 'review']);
  });
  it('"something else" goes straight to contact: a partial interview is still a lead', () => {
    assert.equal(nextStepId(EXAMPLE, 'need', { need: 'other' }), 'contact');
  });
  it('the last step ends', () => {
    assert.equal(nextStepId(EXAMPLE, 'review', {}), END);
  });
  it('unknown steps throw instead of looping', () => {
    assert.throws(() => nextStepId(EXAMPLE, 'nope', {}), /unknown step/);
  });
});
