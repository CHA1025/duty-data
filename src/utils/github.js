const TOKEN = process.env.REACT_APP_GITHUB_TOKEN;
const OWNER = process.env.REACT_APP_REPO_OWNER;
const REPO = process.env.REACT_APP_REPO_NAME;

const headers = {
  Authorization: `token ${TOKEN}`,
  Accept: "application/vnd.github.v3+json",
};

// GitHub에서 JSON 파일 읽기
export const fetchJson = async (path) => {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  // base64 디코딩 (한글 깨짐 방지)
  const content = decodeURIComponent(atob(data.content).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  return { data: JSON.parse(content), sha: data.sha };
};

// GitHub에 JSON 파일 업데이트 (확정)
export const updateJson = async (path, content, sha) => {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `당번 확정 저장 (${new Date().toLocaleDateString()})`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
      sha,
    }),
  });
  return res.ok;
};