import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAtom } from 'jotai';
import { figmaNodeIdAtom, figmaConnectedAtom, mcpDataAtom, screenshotAtom, screenshotMimeTypeAtom, proxyServerUrlAtom, figmaMcpServerUrlAtom } from '../atoms';
import { parseNodeId } from '../figmaNodeUtils';
import styles from '../FigmaAgent.module.scss';
import { MCP_POLL_INTERVAL_MS } from '../../../constants/config';

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
  const [screenshot, setScreenshot] = useAtom(screenshotAtom);
  const [screenshotMimeType, setScreenshotMimeType] = useAtom(screenshotMimeTypeAtom);
  const [proxyServerUrl] = useAtom(proxyServerUrlAtom);
  const [figmaMcpServerUrl, setFigmaMcpServerUrl] = useAtom(figmaMcpServerUrlAtom);
  const [fetching, setFetching] = useState(false);
  const [fetchingScreenshot, setFetchingScreenshot] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(true);


  const resolvedNodeId = useMemo(() => parseNodeId(nodeId), [nodeId]);


  const checkStatus = useCallback(async () => {
    try {
      const url = new URL(`${proxyServerUrl}/api/figma/status`);
      url.searchParams.set('mcpServerUrl', figmaMcpServerUrl);
      const res = await fetch(url.toString());
      const data = await res.json();
      if (isConnectionStatus(data)) {
        const isConnected = data.connected;
        setConnected(isConnected);
        return isConnected;
      } else {
        setConnected(false);
        return false;
      }
    } catch {
      setConnected(false);
      return false;
    }
  }, [proxyServerUrl, figmaMcpServerUrl, setConnected]);


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
      onSuccess(json);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetchingState(false);
    }
  }, [nodeId, resolvedNodeId, proxyServerUrl, figmaMcpServerUrl, setNodeId, t]);


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
            onClick={checkStatus}
            type="button"
          >
            {t('mcp.apply')}
          </button>
          <span className={connected ? styles.statusConnected : styles.statusDisconnected}>
            {connected ? `(●) : ${t('mcp.connected')}` : `(○) : ${t('mcp.disconnected')}`}
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


      {screenshot && (
        <div className={styles.screenshotPreview}>
          <div className={styles.screenshotHeader}>
            <span className={styles.screenshotLabel}><span aria-hidden="true">📸</span> {t('mcp.screenshot_label')}</span>
            <button
              className={styles.screenshotClear}
              onClick={() => setScreenshot('')}
              type="button"
            >
              <span aria-hidden="true">✕</span> {t('mcp.remove')}
            </button>
          </div>

          <img
            className={styles.screenshotThumb}
            src={`data:${screenshotMimeType};base64,${screenshot}`}
            alt={t('mcp.screenshot_alt')}
          />
        </div>
      )}
    </div>
  );
};

export default FigmaMcpPanel;
