const ID_PATTERN = /^[\w-]{11}$/;

// watch?v=, youtu.be/, embed/, shorts/ aur seedha 11-char id sab chalega
function extractVideoId(input) {
  if (!input) return null;
  const text = String(input).trim();
  if (ID_PATTERN.test(text)) return text;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m)\./, '');
  let id = null;

  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v');
    } else {
      const match = url.pathname.match(/^\/(embed|shorts|live)\/([\w-]{11})/);
      if (match) id = match[2];
    }
  }

  return id && ID_PATTERN.test(id) ? id : null;
}

module.exports = { extractVideoId };