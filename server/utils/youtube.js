// ---------------------------------------------------------------------------
// FEATURE: Parses any common YouTube URL format (or a bare video ID) into
// a clean 11-character video ID. Used whenever a host/participant submits
// a "change video" request.
// ---------------------------------------------------------------------------
const ID_PATTERN = /^[\w-]{11}$/;

function extractVideoId(input) {
  if (!input) return null;
  const text = String(input).trim();
  if (ID_PATTERN.test(text)) return text; // already a raw video ID

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null; // not a parseable URL at all
  }

  const host = url.hostname.replace(/^(www|m)\./, '');
  let id = null;

  if (host === 'youtu.be') {
    // Short-link form: youtu.be/<id>
    id = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      // Standard form: youtube.com/watch?v=<id>
      id = url.searchParams.get('v');
    } else {
      // embed/shorts/live forms: youtube.com/embed/<id>, /shorts/<id>, /live/<id>
      const match = url.pathname.match(/^\/(embed|shorts|live)\/([\w-]{11})/);
      if (match) id = match[2];
    }
  }

  return id && ID_PATTERN.test(id) ? id : null;
}

module.exports = { extractVideoId };
