// ---------------------------------------------------------------------------
// Unit tests for permissions.js - the single source of truth for who can
// do what. These are plain functions with no socket/DB involved, so they're
// tested directly with no mocking.
// ---------------------------------------------------------------------------
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canControlPlayback, canManageParticipants } = require('../permissions');

test('canControlPlayback allows host and moderator', () => {
  assert.equal(canControlPlayback('host'), true);
  assert.equal(canControlPlayback('moderator'), true);
});

test('canControlPlayback denies a plain participant', () => {
  assert.equal(canControlPlayback('participant'), false);
});

test('canControlPlayback denies unknown/garbage roles', () => {
  assert.equal(canControlPlayback('admin'), false);
  assert.equal(canControlPlayback(undefined), false);
  assert.equal(canControlPlayback(''), false);
});

test('canManageParticipants allows only the host', () => {
  assert.equal(canManageParticipants('host'), true);
  assert.equal(canManageParticipants('moderator'), false);
  assert.equal(canManageParticipants('participant'), false);
});
