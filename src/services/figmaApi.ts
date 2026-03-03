const WORKERS_API = process.env.WORKERS_API_URL || 'http://localhost:8787';

/**
 * Workers 경유로 Figma 디자인 컨텍스트를 가져옵니다.
 */
export async function fetchDesignContext(
  figmaUrl: string,
  accessToken: string,
): Promise<{ data: string }> {
  const res = await fetch(`${WORKERS_API}/api/figma/mcp/context`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ figmaUrl }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((error as { error: string }).error || `Fetch context failed: ${res.status}`);
  }

  const json = await res.json() as { data: unknown };
  return { data: JSON.stringify(json.data, null, 2) };
}

/**
 * Workers 경유로 Figma 노드 스크린샷을 가져옵니다.
 */
export async function fetchScreenshot(
  figmaUrl: string,
  accessToken: string,
): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(`${WORKERS_API}/api/figma/mcp/screenshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ figmaUrl }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((error as { error: string }).error || `Fetch screenshot failed: ${res.status}`);
  }

  const json = await res.json() as { data: string; mimeType: string };
  return {
    data: json.data,
    mimeType: json.mimeType || 'image/png',
  };
}

/**
 * Workers 경유로 Figma API 연결 상태를 확인합니다.
 */
export async function checkMcpStatus(
  accessToken: string,
): Promise<{ connected: boolean }> {
  try {
    const res = await fetch(`${WORKERS_API}/api/figma/mcp/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return { connected: false };

    const json = await res.json() as { connected: boolean };
    return { connected: json.connected };
  } catch {
    return { connected: false };
  }
}
