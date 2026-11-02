import { verifySession } from "../_lib/auth.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Best-guess link lookup from a name, for TMDB and Grokipedia (scraped —
 * neither blocks server-side fetches, unlike IMDb) and Wikipedia (official
 * opensearch API). These are guesses to review before saving, not certainties
 * — common names can collide with an unrelated person of the same name.
 */
export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env.AUTH))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const name = (url.searchParams.get("name") || "").trim();
  if (!name) return json({ error: "Missing name" }, 400);

  const [tmdb, wiki, grokipedia] = await Promise.all([
    lookupTmdb(name).catch(() => null),
    lookupWikipedia(name).catch(() => null),
    lookupGrokipedia(name).catch(() => null),
  ]);

  return json({ tmdb, wiki, grokipedia });
}

async function lookupTmdb(name) {
  const res = await fetch(`https://www.themoviedb.org/search/person?query=${encodeURIComponent(name)}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;
  const html = await res.text();
  // First "person" result card in search order, e.g.:
  // <a ... data-media-type="person" ... href="/person/13548-james-spader" title="James Spader" ...>
  const m = /<a[^>]*data-media-type="person"[^>]*href="([^"]+)"[^>]*title="([^"]*)"/.exec(html);
  return m ? `https://www.themoviedb.org${m[1]}` : null;
}

async function lookupWikipedia(name) {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(name)}&limit=1&namespace=0&format=json`,
    { headers: { "User-Agent": UA } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (Array.isArray(data) && data[3] && data[3][0]) || null;
}

async function lookupGrokipedia(name) {
  const res = await fetch(`https://grokipedia.com/search?q=${encodeURIComponent(name)}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const re = /href="\/page\/([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const path = m[1];
    // The search page's autocomplete widget embeds a JS template string containing
    // a literal "href=\"/page/' + ... + '\"" — skip anything that isn't a clean slug.
    if (/['"+\s]/.test(path)) continue;
    return `https://grokipedia.com/page/${path}`;
  }
  return null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
