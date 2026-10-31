import { verifySession } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const authenticated = await verifySession(request, env.AUTH);
  return new Response(JSON.stringify({ authenticated }), {
    headers: { "Content-Type": "application/json" },
  });
}
