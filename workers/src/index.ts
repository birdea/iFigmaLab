import { handleOAuthToken, handleOAuthRefresh } from './routes/oauth';
import { handleMcpStatus, handleMcpContext, handleMcpScreenshot } from './routes/mcp';

export interface Env {
  FIGMA_CLIENT_ID: string;
  FIGMA_CLIENT_SECRET: string;
  ALLOWED_ORIGINS: string;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());

  if (!allowed.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // OAuth endpoints
      if (path === '/api/figma/oauth/token' && request.method === 'POST') {
        return await handleOAuthToken(request, env, cors);
      }
      if (path === '/api/figma/oauth/refresh' && request.method === 'POST') {
        return await handleOAuthRefresh(request, env, cors);
      }

      // MCP proxy endpoints
      if (path === '/api/figma/mcp/status' && request.method === 'GET') {
        return await handleMcpStatus(request, env, cors);
      }
      if (path === '/api/figma/mcp/context' && request.method === 'POST') {
        return await handleMcpContext(request, env, cors);
      }
      if (path === '/api/figma/mcp/screenshot' && request.method === 'POST') {
        return await handleMcpScreenshot(request, env, cors);
      }

      return jsonResponse({ error: 'Not Found' }, 404, cors);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return jsonResponse({ error: message }, 500, cors);
    }
  },
};
