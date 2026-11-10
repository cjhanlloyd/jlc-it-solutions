import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreDraft, savedFor } from '../src/invitations/forms/restore.ts';

const form = { toDraft: (d) => ({ filled: true, ...d }) };

test('saved draft for another or no slug is ignored', () => {
  assert.equal(savedFor({ slug: 'a', draft: {} }, 'b'), null);
  assert.equal(savedFor({ draft: {} }, 'a'), null);
  assert.deepEqual(restoreDraft({ slug: 'a', draft: { partner1: 'X' } }, 'b', form), { filled: true });
});

test('matching saved draft goes through toDraft', () => {
  assert.deepEqual(restoreDraft({ slug: 'a', draft: { celebrant: 'Mia' } }, 'a', form), { filled: true, celebrant: 'Mia' });
});
