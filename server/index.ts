import express, { Request, Response } from 'express';
import cors from 'cors';
import { generateHtml } from './gemini.js';
import { checkFigmaStatus, fetchDesignContext, fetchScreenshot } from './figma.js';

const app = express();
const PORT = parseInt(process.env.PROXY_PORT ?? '3006', 10);

const allowedOrigins = ['http://localhost:3000', 'http://localhost:3005'];
const fe = process.env.FRONTEND_PORT;
if (fe && !allowedOrigins.includes(`http://localhost:${fe}`))
  allowedOrigins.push(`http://localhost:${fe}`);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));

// POST /api/ai/generate
app.post('/api/ai/generate', async (req: Request, res: Response) => {
  const { apiKey, model, mcpData, prompt, localAppUrl, screenshot } = req.body as {
    apiKey: string;
    model: string;
    mcpData: string;
    prompt: string;
    localAppUrl?: string;
    screenshot?: { data: string; mimeType: string };
  };

  if (!apiKey) {
    res.status(400).json({ error: 'apiKey is required' });
    return;
  }
  if (!model) {
    res.status(400).json({ error: 'model is required' });
    return;
  }
  if (!mcpData && !prompt) {
    res.status(400).json({ error: 'mcpData or prompt is required' });
    return;
  }

  try {
    const result = await generateHtml({ apiKey, model, mcpData: mcpData ?? '', prompt: prompt ?? '', localAppUrl, screenshot });
    res.json(result);
  } catch (err: unknown) {
    console.error('[/api/ai/generate] Error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// GET /api/figma/status — MCP 프로토콜로 연결 상태 확인
app.get('/api/figma/status', async (req: Request, res: Response) => {
  const mcpServerUrl = typeof req.query.mcpServerUrl === 'string' ? req.query.mcpServerUrl : undefined;
  const status = await checkFigmaStatus(mcpServerUrl);
  res.json(status);
});

// POST /api/figma/fetch-context — MCP로 디자인 컨텍스트 가져오기
app.post('/api/figma/fetch-context', async (req: Request, res: Response) => {
  const { nodeId, mcpServerUrl } = req.body as { nodeId: string; mcpServerUrl?: string };

  if (!nodeId?.trim()) {
    res.status(400).json({ error: 'nodeId is required' });
    return;
  }

  try {
    const data = await fetchDesignContext(nodeId.trim(), mcpServerUrl);
    res.json({ data });
  } catch (err: unknown) {
    console.error('[/api/figma/fetch-context] Error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// POST /api/figma/fetch-screenshot — MCP get_screenshot 도구로 스크린샷 가져오기
app.post('/api/figma/fetch-screenshot', async (req: Request, res: Response) => {
  const { nodeId, mcpServerUrl } = req.body as { nodeId: string; mcpServerUrl?: string };

  if (!nodeId?.trim()) {
    res.status(400).json({ error: 'nodeId is required' });
    return;
  }

  try {
    const screenshot = await fetchScreenshot(nodeId.trim(), mcpServerUrl);
    res.json(screenshot);
  } catch (err: unknown) {
    console.error('[/api/figma/fetch-screenshot] Error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

const srv = app.listen(PORT, () => {
  console.log(`[proxy-server] running at http://localhost:${PORT}`);
});
srv.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[proxy-server] ❌ Port ${PORT} already in use.`);
    console.error(`  → Set PROXY_PORT in .env, or use 'npm run dev' for auto-detection`);
    process.exit(1);
  }
  throw err;
});
