const FIGMA_API_BASE = 'https://api.figma.com/v1';

/** 디자인 컨텍스트 생성에 필요한 핵심 속성만 유지합니다. */
const KEEP_KEYS = new Set([
  'id', 'name', 'type', 'visible',
  'children',
  // 레이아웃
  'layoutMode', 'layoutAlign', 'layoutGrow',
  'primaryAxisAlignItems', 'counterAxisAlignItems',
  'primaryAxisSizingMode', 'counterAxisSizingMode',
  'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
  'itemSpacing',
  // 크기/위치
  'absoluteBoundingBox', 'absoluteRenderBounds',
  'constraints', 'relativeTransform',
  // 스타일
  'fills', 'strokes', 'strokeWeight', 'strokeAlign',
  'cornerRadius', 'rectangleCornerRadii',
  'opacity', 'blendMode', 'effects', 'clipsContent',
  // 텍스트
  'characters', 'style', 'characterStyleOverrides', 'styleOverrideTable',
  // 컴포넌트
  'componentId', 'componentProperties',
]);

/**
 * Figma 노드 트리에서 불필요한 속성을 재귀적으로 제거합니다.
 * 이렇게 하면 보통 70-90% 크기가 줄어듭니다.
 */
function trimNode(node: Record<string, unknown>): Record<string, unknown> {
  const trimmed: Record<string, unknown> = {};

  for (const key of Object.keys(node)) {
    if (!KEEP_KEYS.has(key)) continue;

    if (key === 'children' && Array.isArray(node.children)) {
      trimmed.children = (node.children as Record<string, unknown>[]).map(trimNode);
    } else {
      trimmed[key] = node[key];
    }
  }

  return trimmed;
}

/**
 * Figma API 응답에서 노드 데이터를 경량화합니다.
 */
function trimResponse(data: Record<string, unknown>): unknown {
  const nodes = data.nodes as Record<string, { document: Record<string, unknown> }> | undefined;
  if (!nodes) return data;

  const trimmed: Record<string, unknown> = {};
  for (const [id, entry] of Object.entries(nodes)) {
    trimmed[id] = {
      document: trimNode(entry.document),
    };
  }

  return { nodes: trimmed };
}

/**
 * Figma REST API를 사용하여 파일의 노드 정보를 가져옵니다.
 * 불필요한 속성을 제거하여 경량화된 데이터를 반환합니다.
 */
export async function getFileNodes(
  fileKey: string,
  nodeId: string,
  accessToken: string,
): Promise<unknown> {
  const url = `${FIGMA_API_BASE}/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const error = await res.text();
    const err = new Error(`Figma API error (${res.status}): ${error}`);
    (err as unknown as Record<string, unknown>).status = res.status;
    throw err;
  }

  const raw = (await res.json()) as Record<string, unknown>;
  return trimResponse(raw);
}

/**
 * Figma REST API를 사용하여 노드의 이미지(스크린샷)를 가져옵니다.
 * 이미지 URL을 반환하므로 추가로 fetch하여 base64로 변환합니다.
 */
export async function getNodeImage(
  fileKey: string,
  nodeId: string,
  accessToken: string,
  format: 'png' | 'jpg' | 'svg' = 'png',
  scale = 2,
): Promise<{ data: string; mimeType: string }> {
  // 1. 이미지 URL 요청
  const url = `${FIGMA_API_BASE}/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=${format}&scale=${scale}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const error = await res.text();
    const err = new Error(`Figma Image API error (${res.status}): ${error}`);
    (err as unknown as Record<string, unknown>).status = res.status;
    throw err;
  }

  const json = (await res.json()) as { images: Record<string, string | null> };
  const imageUrl = Object.values(json.images)[0];

  if (!imageUrl) {
    throw new Error('Figma returned no image for the specified node');
  }

  // 2. 이미지 다운로드 → base64 변환
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to download image: ${imageRes.status}`);
  }

  const buffer = await imageRes.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  const mimeType = format === 'svg' ? 'image/svg+xml' : `image/${format}`;

  return { data: base64, mimeType };
}
