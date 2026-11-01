import { verifySession } from "../_lib/auth.js";

const MAX_PROXY_BYTES = 15 * 1024 * 1024;

/**
 * Streams a remote image back same-origin so the browser can read it into a
 * <canvas> for cropping — a direct cross-origin <img> would taint the canvas.
 */
export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env.AUTH))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("url") || "";
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("Bad url", { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new Response("Bad url", { status: 400 });
  }

  let res;
  try {
    res = await fetch(parsed.toString(), { headers: { "User-Agent": "Mozilla/5.0" } });
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
  if (!res.ok) return new Response("Fetch failed", { status: 502 });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) return new Response("Not an image", { status: 400 });

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_PROXY_BYTES) return new Response("Image too large", { status: 400 });

  return new Response(buf, {
    headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=300" },
  });
}
