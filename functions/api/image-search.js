import { verifySession } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env.SESSION_SECRET))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ error: "Missing q" }, 400);
  if (!env.BRAVE_API_KEY) return json({ error: "Search not configured" }, 500);

  const braveUrl = `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(
    q + " actor headshot"
  )}&count=24&safesearch=strict`;

  let res;
  try {
    res = await fetch(braveUrl, {
      headers: { Accept: "application/json", "X-Subscription-Token": env.BRAVE_API_KEY },
    });
  } catch (e) {
    return json({ error: "Search request failed: " + e.message }, 502);
  }
  if (!res.ok) {
    return json({ error: `Search failed (${res.status})` }, 502);
  }

  const data = await res.json();
  const results = (data.results || [])
    .map((r) => ({
      thumbnail: r.thumbnail && r.thumbnail.src,
      full: (r.properties && r.properties.url) || (r.thumbnail && r.thumbnail.src),
      source: r.source || r.url || "",
      title: r.title || "",
    }))
    .filter((r) => r.thumbnail && r.full);

  return json({ results });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
