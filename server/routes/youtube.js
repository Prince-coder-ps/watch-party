// ---------------------------------------------------------------------------
// FEATURE: YouTube search - lets the client look up videos by title instead
// of copy-pasting a link from youtube.com. Wraps the YouTube Data API v3
// "search" endpoint server-side so the API key is never exposed to the browser.
// ---------------------------------------------------------------------------
const express = require('express');
const router = express.Router();

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

// FUNCTION: GET /api/youtube/search?q=... -> { results: [{ videoId, title, channelTitle, thumbnail }] }
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ results: [] });

    if (!process.env.YOUTUBE_API_KEY) {
      return res.status(500).json({ error: 'YouTube search is not configured on the server' });
    }

    const url = new URL(YOUTUBE_SEARCH_URL);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '8');
    url.searchParams.set('q', q);
    url.searchParams.set('key', process.env.YOUTUBE_API_KEY);

    // Node 18+ has a global fetch, no extra package needed
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('YouTube search failed:', data?.error?.message);
      return res.status(502).json({ error: 'YouTube search failed' });
    }

    const results = (data.items || [])
      .filter((item) => item.id?.videoId) // skip channel/playlist results just in case
      .map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.default?.url,
      }));

    res.json({ results });
  } catch (err) {
    console.error('youtube search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
