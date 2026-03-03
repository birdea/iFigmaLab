import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const DEFAULT_FIGMA_BASE_URL = 'http://localhost:3845';
const CONNECT_TIMEOUT = 5000;
const CALL_TIMEOUT = 15000;

type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image'; data: string; mimeType: string };

/**
 * MCP Client를 생성·연결하고 fn 실행 후 반드시 종료한다.
 */
async function withClient<T>(mcpBaseUrl: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(
    { name: 'figma-agent-proxy', version: '1.0.0' },
    { capabilities: {} },
  );
  const sseUrl = `${mcpBaseUrl}/sse`;
  const transport = new SSEClientTransport(new URL(sseUrl));

  await Promise.race([
    client.connect(transport),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Figma Desktop App에 연결할 수 없습니다 (타임아웃). Figma가 실행 중인지 확인해주세요.')), CONNECT_TIMEOUT),
    ),
  ]);

  try {
    return await fn(client);
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

/** Figma MCP 서버 연결 상태 확인 */
export async function checkFigmaStatus(mcpServerUrl?: string): Promise<{ connected: boolean }> {
  const baseUrl = mcpServerUrl ?? DEFAULT_FIGMA_BASE_URL;
  try {
    await withClient(baseUrl, (client) => client.listTools());
    return { connected: true };
  } catch {
    return { connected: false };
  }
}

/** 특정 Node의 디자인 컨텍스트 데이터를 MCP로 가져온다 */
export async function fetchDesignContext(nodeId: string, mcpServerUrl?: string): Promise<string> {
  const baseUrl = mcpServerUrl ?? DEFAULT_FIGMA_BASE_URL;
  return withClient(baseUrl, async (client) => {
    const result = await Promise.race([
      client.callTool({ name: 'get_design_context', arguments: { nodeId } }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Figma 디자인 컨텍스트 조회 타임아웃')), CALL_TIMEOUT),
      ),
    ]);

    if (result.isError) {
      throw new Error(`Figma MCP 오류: ${JSON.stringify(result.content)}`);
    }

    const text = (result.content as TextContent[])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('\n');

    if (!text) {
      throw new Error('Figma MCP에서 빈 응답이 반환되었습니다.');
    }

    return text;
  });
}

/** 특정 Node의 스크린샷을 MCP get_screenshot 도구로 가져온다 */
export async function fetchScreenshot(nodeId: string, mcpServerUrl?: string): Promise<{ data: string; mimeType: string }> {
  const baseUrl = mcpServerUrl ?? DEFAULT_FIGMA_BASE_URL;
  return withClient(baseUrl, async (client) => {
    const result = await Promise.race([
      client.callTool({ name: 'get_screenshot', arguments: { nodeId } }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Figma 스크린샷 조회 타임아웃')), CALL_TIMEOUT),
      ),
    ]);

    if (result.isError) {
      throw new Error(`Figma MCP 오류: ${JSON.stringify(result.content)}`);
    }

    const image = (result.content as ImageContent[]).find((c) => c.type === 'image');
    if (!image) {
      throw new Error('Figma MCP에서 이미지 응답이 반환되지 않았습니다.');
    }

    return { data: image.data, mimeType: image.mimeType };
  });
}
