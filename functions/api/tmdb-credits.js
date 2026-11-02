import { verifySession } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env.AUTH))) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!env.TMDB_API_KEY) return json({ error: "TMDB not configured" }, 500);

  const url = new URL(request.url);
  const tmdbUrl = (url.searchParams.get("tmdbUrl") || "").trim();
  const personId = extractPersonId(tmdbUrl);
  if (!personId) return json({ error: "Could not find a TMDB person ID in that URL" }, 400);

  let res;
  try {
    res = await fetch(
      `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${env.TMDB_API_KEY}`
    );
  } catch (e) {
    return json({ error: "TMDB request failed: " + e.message }, 502);
  }
  if (!res.ok) return json({ error: `TMDB request failed (${res.status})` }, 502);

  const data = await res.json();
  const cast = Array.isArray(data.cast) ? data.cast : [];

  const seen = new Set();
  const credits = [];
  for (const c of cast) {
    const title = c.title || c.name;
    if (!title) continue;
    const mediaType = c.media_type === "tv" ? "tv" : "movie";
    const dedupeKey = mediaType + c.id;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const date = c.release_date || c.first_air_date || "";
    credits.push({
      title,
      year: date ? date.slice(0, 4) : "",
      url: `https://www.themoviedb.org/${mediaType}/${c.id}`,
      character: c.character || "",
    });
  }

  credits.sort((a, b) => (b.year || "0").localeCompare(a.year || "0"));

  return json({ credits });
}

function extractPersonId(tmdbUrl) {
  const m = tmdbUrl.match(/\/person\/(\d+)/);
  return m ? m[1] : null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
