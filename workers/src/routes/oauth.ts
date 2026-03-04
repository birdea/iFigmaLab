import type { Env } from '../index';

const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';
const FIGMA_REFRESH_URL = 'https://api.figma.com/v1/oauth/refresh';

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

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

/**
 * POST /api/figma/oauth/token
 * Authorization code → access_token 교환 (HTTP Basic Auth로 client 인증)
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
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  const res = await fetch(FIGMA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(env.FIGMA_CLIENT_ID, env.FIGMA_CLIENT_SECRET),
    },
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
 * Refresh token → 새 access_token 발급 (Figma 전용 refresh 엔드포인트 사용)
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
    refresh_token: refreshToken,
  });

  const res = await fetch(FIGMA_REFRESH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(env.FIGMA_CLIENT_ID, env.FIGMA_CLIENT_SECRET),
    },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    return jsonResponse({ error: 'Token refresh failed', details: data }, res.status, cors);
  }

  return jsonResponse(data, 200, cors);
}
