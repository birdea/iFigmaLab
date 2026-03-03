import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAtom, useSetAtom } from 'jotai';
import { figmaNodeIdAtom, figmaConnectedAtom, mcpDataAtom, screenshotAtom, screenshotMimeTypeAtom, proxyServerUrlAtom, figmaMcpServerUrlAtom, debugLogAtom } from '../atoms';
import { parseNodeId } from '../figmaNodeUtils';
import styles from '../FigmaAgent.module.scss';
import { MCP_POLL_INTERVAL_MS, MAX_DEBUG_LOG_LINES } from '../../../constants/config';

const POLL_INTERVAL = MCP_POLL_INTERVAL_MS;

interface ConnectionStatus {
  connected: boolean;
}

function isConnectionStatus(v: unknown): v is ConnectionStatus {
  return typeof v === 'object' && v !== null && 'connected' in v && typeof (v as ConnectionStatus).connected === 'boolean';
}

/**
 * Figma MCP와의 통신 환경 설정을 관리하고, Figma 디자인 요소에서 상태를 가져오는 패널.
 */
const FigmaMcpPanel: React.FC = () => {
  const { t } = useTranslation();
  const [nodeId, setNodeId] = useAtom(figmaNodeIdAtom);
  const [connected, setConnected] = useAtom(figmaConnectedAtom);
  const [, setMcpData] = useAtom(mcpDataAtom);
  const [, setScreenshot] = useAtom(screenshotAtom);
  const [, setScreenshotMimeType] = useAtom(screenshotMimeTypeAtom);
  const [proxyServerUrl, setProxyServerUrl] = useAtom(proxyServerUrlAtom);
  const [figmaMcpServerUrl, setFigmaMcpServerUrl] = useAtom(figmaMcpServerUrlAtom);
  const [proxyReachable, setProxyReachable] = useState<boolean | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchingScreenshot, setFetchingScreenshot] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(true);
  // 폴링에 사용할 "커밋된" URL — Apply 클릭 시에만 갱신
  const committedProxyUrlRef = useRef(proxyServerUrl);
  const committedMcpUrlRef = useRef(figmaMcpServerUrl);

  const setDebugLog = useSetAtom(debugLogAtom);
  const appendLog = useCallback((line: string) => {
    const ts = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setDebugLog(prev => {
      const newLine = `[${ts}] ${line}\n`;
      const combined = prev + newLine;
      const lines = combined.split('\n');
      if (lines.length > MAX_DEBUG_LOG_LINES) {
        return lines.slice(lines.length - MAX_DEBUG_LOG_LINES).join('\n');
      }
      return combined;
    });
  }, [setDebugLog]);


  const resolvedNodeId = useMemo(() => parseNodeId(nodeId), [nodeId]);

  // checkStatus는 ref를 읽으므로 URL atom 변경으로 재생성되지 않음
  const checkStatus = useCallback(async () => {
    const proxyUrl = committedProxyUrlRef.current;
    const mcpUrl = committedMcpUrlRef.current;
    appendLog(`[Proxy] Checking ${proxyUrl} …`);
    try {
      const url = new URL(`${proxyUrl}/api/figma/status`);
      url.searchParams.set('mcpServerUrl', mcpUrl);
      const res = await fetch(url.toString());
      if (!res.ok) {
        setProxyReachable(false);
        setConnected(null);
        appendLog(`[Proxy] ✗ Unexpected HTTP ${res.status}`);
        return false;
      }
      const data = await res.json();
      setProxyReachable(true);
      appendLog(`[Proxy] ✓ Reachable`);
      if (isConnectionStatus(data)) {
        const isConnected = data.connected;
        setConnected(isConnected);
        appendLog(isConnected
          ? `[MCP] ✓ Connected: ${mcpUrl}`
          : `[MCP] ✗ Figma not connected (mcpServerUrl=${mcpUrl})`);
        return isConnected;
      } else {
        setConnected(false);
        appendLog(`[MCP] ✗ Unexpected response: ${JSON.stringify(data)}`);
        return false;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setProxyReachable(false);
      setConnected(null); // Proxy 미도달 → MCP 상태 알 수 없음
      appendLog(`[Proxy] ✗ Unreachable: ${msg}`);
      return false;
    }
  }, [setConnected, setProxyReachable, appendLog]);

  const handleApplyProxy = useCallback(() => {
    committedProxyUrlRef.current = proxyServerUrl;
    appendLog(`[Proxy] Apply → ${proxyServerUrl}`);
    checkStatus();
  }, [proxyServerUrl, checkStatus, appendLog]);

  /** 3006~3015 범위를 순차 스캔하여 응답하는 proxy 포트를 자동 발견합니다. */
  const handleAutoDetect = useCallback(async () => {
    setDetecting(true);
    appendLog('[Proxy] Auto-detecting proxy server port (3006–3015)…');
    const mcpUrl = committedMcpUrlRef.current;
    for (let port = 3006; port <= 3015; port++) {
      const candidateUrl = `http://localhost:${port}`;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1500);
        const statusUrl = new URL(`${candidateUrl}/api/figma/status`);
        statusUrl.searchParams.set('mcpServerUrl', mcpUrl);
        const res = await fetch(statusUrl.toString(), { signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok) {
          setProxyServerUrl(candidateUrl);
          committedProxyUrlRef.current = candidateUrl;
          appendLog(`[Proxy] ✓ Found proxy at ${candidateUrl}`);
          setDetecting(false);
          checkStatus();
          return;
        }
      } catch {
        // 해당 포트에 서버 없음 — 다음 포트 시도
      }
      appendLog(`[Proxy] … ${port} no response`);
    }
    appendLog('[Proxy] ✗ No proxy found in range 3006–3015');
    setDetecting(false);
  }, [setProxyServerUrl, checkStatus, appendLog]);

  const handleApplyMcp = useCallback(() => {
    committedMcpUrlRef.current = figmaMcpServerUrl;
    appendLog(`[MCP] Apply → ${figmaMcpServerUrl}`);
    checkStatus();
  }, [figmaMcpServerUrl, checkStatus, appendLog]);

  const NPX_CMD = 'npx ifigmalab-server';

  const handleCopyCommand = useCallback(() => {
    navigator.clipboard.writeText(NPX_CMD).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleDownloadScript = useCallback((platform: 'mac' | 'windows') => {
    const isMac = platform === 'mac';
    const content = isMac
      ? `#!/bin/bash\n${NPX_CMD}\n`
      : `@echo off\r\n${NPX_CMD}\r\npause\r\n`;
    const filename = isMac ? 'start-ifigmalab-proxy.command' : 'start-ifigmalab-proxy.bat';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    appendLog(`[Proxy] Downloaded ${filename}`);
  }, [appendLog]);


  useEffect(() => {
    let active = true;
    let delay = POLL_INTERVAL;

    const poll = async () => {
      if (!active) return;

      // Pause if tab is not visible
      if (isVisibleRef.current) {
        const ok = await checkStatus();
        if (!active) return;
        delay = ok ? POLL_INTERVAL : Math.min(delay * 2, 60000);
      }

      timerRef.current = setTimeout(poll, delay);
    };

    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      if (isVisibleRef.current && active) {
        // Resume polling quickly if visible
        if (timerRef.current) clearTimeout(timerRef.current);
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    poll();

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [checkStatus]);


  type FigmaApiResponse = { error?: string; data?: string; mimeType?: string };

  const fetchFigmaData = useCallback(async (
    endpoint: string,
    setFetchingState: (val: boolean) => void,
    onSuccess: (json: FigmaApiResponse) => void
  ) => {
    if (!nodeId.trim()) {
      setFetchError(t('mcp.error_node_id_required'));
      return;
    }

    if (!resolvedNodeId) {
      setFetchError(t('mcp.error_node_id_invalid'));
      return;
    }

    setNodeId(resolvedNodeId);
    setFetchingState(true);
    setFetchError('');
    appendLog(`[Figma] ${endpoint} ← node:${resolvedNodeId} via ${proxyServerUrl}`);
    try {
      const res = await fetch(`${proxyServerUrl}/api/figma/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: resolvedNodeId, mcpServerUrl: figmaMcpServerUrl }),
      });
      const text = await res.text();
      let json: FigmaApiResponse = {};
      try { json = JSON.parse(text); } catch {
        throw new Error(t('mcp.error_server_response', { text: text.slice(0, 120) }));
      }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      appendLog(`[Figma] ✓ ${endpoint} OK (${text.length} chars)`);
      onSuccess(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`[Figma] ✗ ${endpoint} failed: ${msg}`);
      setFetchError(msg);
    } finally {
      setFetchingState(false);
    }
  }, [nodeId, resolvedNodeId, proxyServerUrl, figmaMcpServerUrl, setNodeId, t, appendLog]);


  /** Proxy Server와 연계하여 Figma Node 정보를 Fetch 하여 로컬 상태에 주입합니다. */
  const handleFetch = useCallback(() => fetchFigmaData(
    'fetch-context',
    setFetching,
    (json) => setMcpData(json.data ?? '')
  ), [fetchFigmaData, setFetching, setMcpData]);


  /** Proxy Server와 연계하여 대상 Figma Node 영역의 Screenshot을 Fetch 해옵니다. */
  const handleFetchScreenshot = useCallback(() => fetchFigmaData(
    'fetch-screenshot',
    setFetchingScreenshot,
    (json) => {
      setScreenshot(json.data ?? '');
      setScreenshotMimeType(json.mimeType ?? 'image/png');
    }
  ), [fetchFigmaData, setFetchingScreenshot, setScreenshot, setScreenshotMimeType]);


  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>{t('mcp.title')}</div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>{t('mcp.proxy_url')}</label>
        <div className={styles.inputWithBtn}>
          <input
            className={styles.formInput}
            type="url"
            placeholder="http://localhost:3006"
            value={proxyServerUrl}
            onChange={e => setProxyServerUrl(e.target.value)}
          />
          <button
            className={styles.fetchBtn}
            onClick={handleApplyProxy}
            disabled={detecting}
            type="button"
          >
            {t('mcp.apply')}
          </button>
          <button
            className={styles.fetchBtn}
            onClick={handleAutoDetect}
            disabled={detecting}
            type="button"
          >
            {detecting ? t('mcp.detecting') : t('mcp.auto_detect')}
          </button>
          <span className={proxyReachable === null ? styles.statusUnknown : proxyReachable ? styles.statusConnected : styles.statusDisconnected}>
            {proxyReachable === null ? `(–) : ${t('mcp.unknown')}` : proxyReachable ? `(●) : ${t('mcp.connected')}` : `(○) : ${t('mcp.disconnected')}`}
          </span>
        </div>
      </div>

      {proxyReachable === false && (
        <div className={styles.proxyGuide}>
          <div className={styles.proxyGuideTitle}>{t('mcp.proxy_guide_title')}</div>
          <p className={styles.proxyGuideDesc}>{t('mcp.proxy_guide_desc')}</p>
          <div className={styles.proxyCommandRow}>
            <code className={styles.proxyCommand}>{NPX_CMD}</code>
            <button className={styles.proxyCopyBtn} onClick={handleCopyCommand} type="button">
              {copied ? t('mcp.proxy_guide_copied') : t('mcp.proxy_guide_copy')}
            </button>
          </div>
          <div className={styles.proxyDownloadRow}>
            <span className={styles.proxyDownloadLabel}>{t('mcp.proxy_guide_download_label')}</span>
            <button className={styles.proxyDownloadBtn} onClick={() => handleDownloadScript('mac')} type="button">
              {t('mcp.proxy_guide_download_macos')}
            </button>
            <button className={styles.proxyDownloadBtn} onClick={() => handleDownloadScript('windows')} type="button">
              {t('mcp.proxy_guide_download_windows')}
            </button>
          </div>
          <p className={styles.proxyGuideHint}>{t('mcp.proxy_guide_macos_hint')}</p>
        </div>
      )}

      <div className={styles.formRow}>
        <label className={styles.formLabel}>{t('mcp.server_url')}</label>
        <div className={styles.inputWithBtn}>
          <input
            className={styles.formInput}
            type="url"
            placeholder="http://localhost:3845"
            value={figmaMcpServerUrl}
            onChange={e => setFigmaMcpServerUrl(e.target.value)}
          />
          <button
            className={styles.fetchBtn}
            onClick={handleApplyMcp}
            type="button"
          >
            {t('mcp.apply')}
          </button>
          <span className={connected === null ? styles.statusUnknown : connected ? styles.statusConnected : styles.statusDisconnected}>
            {connected === null ? `(–) : ${t('mcp.unknown')}` : connected ? `(●) : ${t('mcp.connected')}` : `(○) : ${t('mcp.disconnected')}`}
          </span>
        </div>
      </div>


      <div className={styles.formRow}>
        <label className={styles.formLabel}>{t('mcp.node_id')}</label>
        <div className={styles.inputWithBtn}>
          <input
            className={styles.formInput}
            type="text"
            placeholder={t('mcp.node_id_placeholder')}
            value={nodeId}
            onChange={e => setNodeId(e.target.value)}
          />
          <button
            className={styles.fetchBtn}
            onClick={handleFetch}
            disabled={fetching || fetchingScreenshot}
            type="button"
          >
            {fetching ? t('mcp.fetching') : t('mcp.fetch_data')}
          </button>
          <button
            className={styles.fetchScreenshotBtn}
            onClick={handleFetchScreenshot}
            disabled={fetching || fetchingScreenshot || !connected || !resolvedNodeId}
            type="button"
          >
            {fetchingScreenshot ? t('mcp.capturing') : <><span aria-hidden="true">📸</span> {t('mcp.screenshot')}</>}
          </button>
        </div>
        {fetchError && <span className={styles.errorText}>{fetchError}</span>}
      </div>


    </div>
  );
};

export default FigmaMcpPanel;
