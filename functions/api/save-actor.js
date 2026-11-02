import { verifySession } from "../_lib/auth.js";
import { getFile, commitFiles } from "../_lib/github.js";

const OWNER = "megzjudge";
const REPO = "favactors";
const BRANCH = "main";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env.AUTH))) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!env.GITHUB_TOKEN) return json({ error: "GitHub not configured" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const name = (body.name || "").trim();
  const originalName = (body.originalName || "").trim();
  const imageData = (body.imageData || "").trim();
  if (!name) return json({ error: "Name is required" }, 400);

  let actorsFile;
  try {
    actorsFile = await getFile(OWNER, REPO, BRANCH, "actors.json", env.GITHUB_TOKEN);
  } catch (e) {
    return json({ error: "Could not read repo files: " + e.message }, 502);
  }

  let actors;
  try {
    actors = JSON.parse(actorsFile.content);
  } catch (e) {
    return json({ error: "actors.json is not valid JSON: " + e.message }, 500);
  }

  // originalName (set when editing) targets the entry being replaced even if
  // the name itself was also changed in this save.
  const matchName = originalName || name;
  const existingIdx = actors.findIndex((a) => a.name.toLowerCase() === matchName.toLowerCase());
  const existingEntry = existingIdx >= 0 ? actors[existingIdx] : null;

  if (!imageData && !existingEntry) {
    return json({ error: "No cropped image received" }, 400);
  }

  const filesToCommit = [];
  let key;

  if (imageData) {
    let imageByteLength;
    try {
      imageByteLength = atob(imageData).length;
    } catch {
      return json({ error: "Cropped image data is not valid base64" }, 400);
    }
    if (imageByteLength > MAX_IMAGE_BYTES) {
      return json({ error: "Cropped image too large" }, 400);
    }

    key = sanitizeKey(name);
    if (!key) return json({ error: "Name produced an empty key" }, 400);
    const imagePath = `images/${key}.jpg`;

    let scriptFile;
    try {
      scriptFile = await getFile(OWNER, REPO, BRANCH, "script.js", env.GITHUB_TOKEN);
    } catch (e) {
      return json({ error: "Could not read repo files: " + e.message }, 502);
    }

    let scriptText;
    try {
      scriptText = patchAssets(scriptFile.content, key, imagePath);
    } catch (e) {
      return json({ error: "Could not patch script.js: " + e.message }, 500);
    }

    filesToCommit.push({ path: "script.js", content: scriptText, encoding: "utf-8" });
    filesToCommit.push({ path: imagePath, content: imageData, encoding: "base64" });
  } else {
    // No new photo picked — keep whatever this actor already has (possibly none).
    key = existingEntry.photo || "";
  }

  const entry = {
    name,
    photo: key,
    initials: (body.initials || "").trim(),
    imdb: (body.imdb || "").trim(),
    tmdb: (body.tmdb || "").trim(),
    wiki: (body.wiki || "").trim(),
    grokipedia: (body.grokipedia || "").trim(),
    favs: Array.isArray(body.favs)
      ? body.favs
          .filter((f) => f && f.t && f.u)
          .map((f) => ({ t: String(f.t).trim(), u: String(f.u).trim() }))
      : [],
  };

  if (existingIdx >= 0) {
    actors[existingIdx] = entry;
  } else {
    actors.push(entry);
  }
  filesToCommit.unshift({ path: "actors.json", content: JSON.stringify(actors, null, 2) + "\n", encoding: "utf-8" });

  let commitSha;
  try {
    commitSha = await commitFiles(
      OWNER,
      REPO,
      BRANCH,
      env.GITHUB_TOKEN,
      filesToCommit,
      `admin: ${existingIdx >= 0 ? "update" : "add"} ${name}`
    );
  } catch (e) {
    return json({ error: "Commit failed: " + e.message }, 502);
  }

  return json({ ok: true, commit: commitSha, key, updated: existingIdx >= 0 });
}

function sanitizeKey(name) {
  return name.replace(/[^A-Za-z0-9]/g, "");
}

function patchAssets(scriptText, key, path) {
  const marker = "var ASSETS = {";
  const start = scriptText.indexOf(marker);
  if (start === -1) throw new Error("ASSETS block not found in script.js");
  const closeIdx = scriptText.indexOf("\n};", start);
  if (closeIdx === -1) throw new Error("ASSETS block close not found");

  const block = scriptText.slice(start, closeIdx);
  const existingKeyRe = new RegExp(`["']${key}["']\\s*:`, "m");
  if (existingKeyRe.test(block)) {
    const lineRe = new RegExp(`(["']${key}["']\\s*:\\s*)["'][^"']*["']`);
    return scriptText.replace(lineRe, `$1"${path}"`);
  }

  const insertion = `,\n  "${key}": "${path}"`;
  return scriptText.slice(0, closeIdx) + insertion + scriptText.slice(closeIdx);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
