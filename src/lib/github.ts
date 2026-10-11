/**
 * GitHub REST API の最小ラッパー（サーバー専用）。
 * GITHUB_TOKEN は churin-navi リポジトリだけに Contents: Read and write / Issues: Read and write を付けた
 * fine-grained token を想定。
 */
const API = "https://api.github.com";

function repo() {
  return process.env.GITHUB_REPO || "Takahashi130/churin-navi";
}

function headers() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN が未設定です");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "churin-navi",
  };
}

export async function getJsonFile<T>(path: string, branch = "main"): Promise<{ data: T; sha: string }> {
  const res = await fetch(`${API}/repos/${repo()}/contents/${path}?ref=${branch}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub からの読み込みに失敗しました（HTTP ${res.status}）`);
  const json = (await res.json()) as { content: string; sha: string };
  return { data: JSON.parse(Buffer.from(json.content, "base64").toString("utf8")) as T, sha: json.sha };
}

/** 競合（409）は呼び出し側でやり直せるよう、ステータス付きで投げる */
export async function putJsonFile(path: string, data: unknown, sha: string, message: string, branch = "main") {
  const content = Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf8").toString("base64");
  const res = await fetch(`${API}/repos/${repo()}/contents/${path}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ message, content, sha, branch }),
  });
  if (!res.ok) {
    const err = new Error(`GitHub への書き込みに失敗しました（HTTP ${res.status}）`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

export async function createIssue(title: string, body: string, labels: string[]): Promise<string> {
  const res = await fetch(`${API}/repos/${repo()}/issues`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ title, body, labels }),
  });
  if (!res.ok) throw new Error(`GitHub Issue の作成に失敗しました（HTTP ${res.status}）`);
  const json = (await res.json()) as { html_url: string };
  return json.html_url;
}
