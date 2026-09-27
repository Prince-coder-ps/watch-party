// ---------------------------------------------------------------------------
// Unit tests for utils/youtube.js - covers every URL shape the "change
// video" flow is expected to accept, plus the inputs it should reject.
// ---------------------------------------------------------------------------
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractVideoId } = require('../utils/youtube');

const ID = 'dQw4w9WgXcQ'; // a real, well-known 11-char video ID

test('accepts a bare video ID', () => {
  assert.equal(extractVideoId(ID), ID);
});

test('parses the standard watch URL', () => {
  assert.equal(extractVideoId(`https://www.youtube.com/watch?v=${ID}`), ID);
});

test('parses a watch URL with extra query params', () => {
  assert.equal(extractVideoId(`https://youtube.com/watch?v=${ID}&t=42s&list=PL123`), ID);
});

test('parses the youtu.be short link', () => {
  assert.equal(extractVideoId(`https://youtu.be/${ID}`), ID);
});

test('parses youtu.be with a trailing query string', () => {
  assert.equal(extractVideoId(`https://youtu.be/${ID}?t=10`), ID);
});

test('parses embed / shorts / live URLs', () => {
  assert.equal(extractVideoId(`https://www.youtube.com/embed/${ID}`), ID);
  assert.equal(extractVideoId(`https://www.youtube.com/shorts/${ID}`), ID);
  assert.equal(extractVideoId(`https://www.youtube.com/live/${ID}`), ID);
});

test('parses mobile (m.youtube.com) and music.youtube.com hosts', () => {
  assert.equal(extractVideoId(`https://m.youtube.com/watch?v=${ID}`), ID);
  assert.equal(extractVideoId(`https://music.youtube.com/watch?v=${ID}`), ID);
});

test('works without an explicit https:// prefix', () => {
  assert.equal(extractVideoId(`youtu.be/${ID}`), ID);
});

test('rejects empty/missing input', () => {
  assert.equal(extractVideoId(''), null);
  assert.equal(extractVideoId(null), null);
  assert.equal(extractVideoId(undefined), null);
});

test('rejects a non-YouTube URL', () => {
  assert.equal(extractVideoId('https://vimeo.com/123456789'), null);
});

test('rejects a YouTube URL with no video id', () => {
  assert.equal(extractVideoId('https://www.youtube.com/'), null);
  assert.equal(extractVideoId('https://www.youtube.com/results?search_query=lofi'), null);
});

test('rejects garbage text', () => {
  assert.equal(extractVideoId('not a url at all'), null);
});
