const API = "https://api.github.com";

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "favactors-admin",
  };
}

async function gh(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...ghHeaders(token), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function getFile(owner, repo, branch, path, token) {
  const data = await gh(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    token
  );
  const content = atob(data.content.replace(/\n/g, ""));
  return { content, sha: data.sha };
}

/**
 * Bundles multiple file writes into a single commit via the Git Data API,
 * so a partial failure never leaves actors.json, script.js and the image out of sync.
 */
export async function commitFiles(owner, repo, branch, token, files, message) {
  const refData = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, token);
  const baseCommitSha = refData.object.sha;
  const baseCommit = await gh(`/repos/${owner}/${repo}/git/commits/${baseCommitSha}`, token);
  const baseTreeSha = baseCommit.tree.sha;

  const treeEntries = [];
  for (const f of files) {
    const body =
      f.encoding === "base64"
        ? { content: f.content, encoding: "base64" }
        : { content: f.content, encoding: "utf-8" };
    const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    treeEntries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await gh(`/repos/${owner}/${repo}/git/trees`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });

  const newCommit = await gh(`/repos/${owner}/${repo}/git/commits`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }),
  });

  await gh(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha: newCommit.sha }),
  });

  return newCommit.sha;
}
