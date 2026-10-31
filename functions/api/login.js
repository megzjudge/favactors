import { createSessionCookie, timingSafeStringEqual } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Bad request" }, 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!env.AUTH || !timingSafeStringEqual(password, env.AUTH)) {
    return json({ ok: false, error: "Invalid password" }, 401);
  }

  const cookie = await createSessionCookie(env.AUTH);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
