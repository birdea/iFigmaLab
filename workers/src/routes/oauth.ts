import type { Env } from '../index';

const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';

interface TokenRequest {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

interface RefreshRequest {
  refreshToken: string;
}

function jsonResponse(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

/**
 * POST /api/figma/oauth/token
 * Authorization code → access_token 교환 (client_secret 서버사이드 처리)
 */
export async function handleOAuthToken(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const body = (await request.json()) as TokenRequest;
  const { code, codeVerifier, redirectUri } = body;

  if (!code || !codeVerifier || !redirectUri) {
    return jsonResponse({ error: 'Missing required fields: code, codeVerifier, redirectUri' }, 400, cors);
  }

  const params = new URLSearchParams({
    client_id: env.FIGMA_CLIENT_ID,
    client_secret: env.FIGMA_CLIENT_SECRET,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(FIGMA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    return jsonResponse({ error: 'Token exchange failed', details: data }, res.status, cors);
  }

  return jsonResponse(data, 200, cors);
}

/**
 * POST /api/figma/oauth/refresh
 * Refresh token → 새 access_token 발급
 */
export async function handleOAuthRefresh(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const body = (await request.json()) as RefreshRequest;
  const { refreshToken } = body;

  if (!refreshToken) {
    return jsonResponse({ error: 'Missing required field: refreshToken' }, 400, cors);
  }

  const params = new URLSearchParams({
    client_id: env.FIGMA_CLIENT_ID,
    client_secret: env.FIGMA_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(FIGMA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    return jsonResponse({ error: 'Token refresh failed', details: data }, res.status, cors);
  }

  return jsonResponse(data, 200, cors);
}
