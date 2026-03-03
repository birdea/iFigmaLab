const FIGMA_AUTH_URL = 'https://www.figma.com/oauth';
const WORKERS_API = process.env.WORKERS_API_URL || 'http://localhost:8787';
const CLIENT_ID = process.env.FIGMA_OAUTH_CLIENT_ID || '';
const REDIRECT_URI = process.env.FIGMA_OAUTH_REDIRECT_URI || `${window.location.origin}/oauth/callback`;

const OAUTH_SCOPES = 'file_content:read';

// --- PKCE helpers ---

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, length);
}

export function generateCodeVerifier(): string {
  return generateRandomString(64);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// --- OAuth flow ---

export interface OAuthState {
  codeVerifier: string;
  state: string;
}

/**
 * OAuth 인가 URL을 생성하고 PKCE 상태를 반환합니다.
 */
export async function buildAuthUrl(): Promise<{ url: string; oauthState: OAuthState }> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: OAUTH_SCOPES,
    state,
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return {
    url: `${FIGMA_AUTH_URL}?${params.toString()}`,
    oauthState: { codeVerifier, state },
  };
}

// --- Token exchange (via Workers) ---

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}

/**
 * Authorization code를 Workers 경유로 access_token과 교환합니다.
 */
export async function exchangeToken(code: string, codeVerifier: string): Promise<TokenResponse> {
  const res = await fetch(`${WORKERS_API}/api/figma/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      codeVerifier,
      redirectUri: REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((error as { error: string }).error || `Token exchange failed: ${res.status}`);
  }

  return res.json() as Promise<TokenResponse>;
}

/**
 * Refresh token으로 새 access_token을 발급받습니다.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${WORKERS_API}/api/figma/oauth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((error as { error: string }).error || `Token refresh failed: ${res.status}`);
  }

  return res.json() as Promise<TokenResponse>;
}
