/**
 * Figma URL에서 fileKey와 nodeId를 추출합니다.
 * Remote MCP Server는 Figma URL 전체를 필요로 하므로 fullUrl도 반환합니다.
 */
export interface FigmaUrlParts {
  fullUrl: string;
  fileKey: string;
  nodeId: string; // 콜론 구분 (22041:216444)
}

/**
 * Figma URL을 파싱하여 fileKey와 nodeId를 추출합니다.
 * @param raw - 사용자가 입력한 Figma URL
 * @returns 파싱 결과 또는 유효하지 않은 URL이면 null
 */
export function parseFigmaUrl(raw: string): FigmaUrlParts | null {
  const match = raw.match(
    /https?:\/\/(?:www\.)?figma\.com\/design\/([^/]+)\/[^?]*\?[^]*node-id=([^&\s]+)/
  );
  if (!match) return null;
  return {
    fullUrl: match[0],
    fileKey: match[1],
    nodeId: match[2].replace(/-/g, ':'),
  };
}
