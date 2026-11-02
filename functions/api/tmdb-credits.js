import { verifySession } from "../_lib/auth.js";

const MAX_BYTES = 2 * 1024 * 1024;

// Matches each row in the "Acting" credits table on a TMDB person page, e.g.:
//   <td class="year">2018</td>
//   <td class="seperator"><span data-url="/tv/70453-sharp-objects" ... data-type="tv" ...></span></td>
//   <td class="role ..."><a class="tooltip" href="/tv/70453-sharp-objects"><bdi>Sharp Objects</bdi>
const CREDIT_RE =
  /<td class="year">\s*([^<]*?)\s*<\/td>\s*<td class="seperator"><span data-url="([^"]+)"[^>]*data-type="([^"]+)"[^>]*><\/span><\/td>\s*<td class="role[^"]*">\s*<a class="tooltip" href="[^"]*"><bdi>([^<]*)<\/bdi>/gs;

/**
 * Scrapes TMDB's own person page rather than calling TMDB's API — no API key
 * needed. TMDB (unlike IMDb) doesn't bot-block server-side fetches; verified
 * live against a real person page before writing this.
 */
export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env.AUTH))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const tmdbUrl = (url.searchParams.get("tmdbUrl") || "").trim();
  let parsed;
  try {
    parsed = new URL(tmdbUrl);
  } catch {
    return json({ error: "Bad url" }, 400);
  }
  if (!/(^|\.)themoviedb\.org$/.test(parsed.hostname)) {
    return json({ error: "URL must be a themoviedb.org person page" }, 400);
  }

  let res;
  try {
    res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
  } catch (e) {
    return json({ error: "Fetch failed: " + e.message }, 502);
  }
  if (!res.ok) return json({ error: `Fetch failed (${res.status})` }, 502);

  const html = await readLimited(res.body, MAX_BYTES);

  const seen = new Set();
  const credits = [];
  for (const m of html.matchAll(CREDIT_RE)) {
    const path = m[2];
    const mediaType = m[3] === "tv" ? "tv" : "movie";
    const title = decodeEntities(m[4]);
    if (!title || seen.has(path)) continue;
    seen.add(path);

    const rawYear = m[1].trim();
    credits.push({
      title,
      year: /^\d{4}$/.test(rawYear) ? rawYear : "",
      url: `https://www.themoviedb.org${path}`,
      mediaType,
    });
  }

  credits.sort((a, b) => (b.year || "0").localeCompare(a.year || "0"));

  return json({ credits });
}

async function readLimited(stream, maxBytes) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    result += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return result;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
