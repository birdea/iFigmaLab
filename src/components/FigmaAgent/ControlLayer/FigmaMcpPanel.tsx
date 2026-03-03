import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAtom, useSetAtom } from 'jotai';
import { figmaUrlAtom, figmaConnectedAtom, mcpDataAtom, screenshotAtom, screenshotMimeTypeAtom, debugLogAtom } from '../atoms';
import { parseFigmaUrl } from '../figmaNodeUtils';
import { useFigmaAuth } from '../../../hooks/useFigmaAuth';
import { fetchDesignContext, fetchScreenshot } from '../../../services/figmaApi';
import styles from '../FigmaAgent.module.scss';
import { MAX_DEBUG_LOG_LINES } from '../../../constants/config';

/**
 * Figma Remote MCP 연동 패널.
 * OAuth 인증 → Figma URL 입력 → Context/Screenshot 가져오기
 */
const FigmaMcpPanel: React.FC = () => {
  const { t } = useTranslation();
  const [figmaUrl, setFigmaUrl] = useAtom(figmaUrlAtom);
  const [, setConnected] = useAtom(figmaConnectedAtom);
  const setMcpData = useSetAtom(mcpDataAtom);
  const setScreenshot = useSetAtom(screenshotAtom);
  const setScreenshotMimeType = useSetAtom(screenshotMimeTypeAtom);

  const [fetching, setFetching] = useState(false);
  const [fetchingScreenshot, setFetchingScreenshot] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const { isAuthenticated, accessToken, login, logout } = useFigmaAuth();

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

  const parsedUrl = useMemo(() => parseFigmaUrl(figmaUrl), [figmaUrl]);

  const handleFetchContext = useCallback(async () => {
    if (!figmaUrl.trim()) {
      setFetchError(t('mcp.error_figma_url_required'));
      return;
    }
    if (!parsedUrl) {
      setFetchError(t('mcp.error_figma_url_invalid'));
      return;
    }
    if (!accessToken) {
      setFetchError(t('mcp.error_auth_required'));
      return;
    }

    setFetching(true);
    setFetchError('');
    appendLog(`[Figma] Fetching context for ${parsedUrl.fileKey}/${parsedUrl.nodeId}`);

    try {
      const result = await fetchDesignContext(parsedUrl.fullUrl, accessToken);
      setMcpData(result.data);
      setConnected(true);
      appendLog(`[Figma] ✓ Context fetched (${result.data.length} chars)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`[Figma] ✗ Context fetch failed: ${msg}`);
      setFetchError(msg);
      setConnected(false);
    } finally {
      setFetching(false);
    }
  }, [figmaUrl, parsedUrl, accessToken, setMcpData, setConnected, appendLog, t]);

  const handleFetchScreenshot = useCallback(async () => {
    if (!parsedUrl || !accessToken) return;

    setFetchingScreenshot(true);
    setFetchError('');
    appendLog(`[Figma] Capturing screenshot for ${parsedUrl.fileKey}/${parsedUrl.nodeId}`);

    try {
      const result = await fetchScreenshot(parsedUrl.fullUrl, accessToken);
      setScreenshot(result.data);
      setScreenshotMimeType(result.mimeType);
      appendLog(`[Figma] ✓ Screenshot captured (${result.mimeType})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendLog(`[Figma] ✗ Screenshot failed: ${msg}`);
      setFetchError(msg);
    } finally {
      setFetchingScreenshot(false);
    }
  }, [parsedUrl, accessToken, setScreenshot, setScreenshotMimeType, appendLog]);

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>{t('mcp.title')}</div>

      {/* OAuth Authentication */}
      <div className={styles.formRow}>
        <label className={styles.formLabel}>{t('mcp.figma_auth')}</label>
        <div className={styles.inputWithBtn}>
          {isAuthenticated ? (
            <>
              <span className={styles.statusConnected}>
                {t('mcp.authenticated')}
              </span>
              <button
                className={styles.fetchBtn}
                onClick={logout}
                type="button"
              >
                {t('mcp.sign_out')}
              </button>
            </>
          ) : (
            <button
              className={styles.fetchBtn}
              onClick={login}
              type="button"
            >
              {t('mcp.sign_in_figma')}
            </button>
          )}
        </div>
      </div>

      {/* Figma URL Input */}
      <div className={styles.formRow}>
        <label className={styles.formLabel}>{t('mcp.figma_url')}</label>
        <div className={styles.inputWithBtn}>
          <input
            className={styles.formInput}
            type="url"
            placeholder={t('mcp.figma_url_placeholder')}
            value={figmaUrl}
            onChange={e => setFigmaUrl(e.target.value)}
          />
          <button
            className={styles.fetchBtn}
            onClick={handleFetchContext}
            disabled={fetching || fetchingScreenshot || !isAuthenticated}
            type="button"
          >
            {fetching ? t('mcp.fetching') : t('mcp.fetch_data')}
          </button>
          <button
            className={styles.fetchScreenshotBtn}
            onClick={handleFetchScreenshot}
            disabled={fetching || fetchingScreenshot || !isAuthenticated || !parsedUrl}
            type="button"
          >
            {fetchingScreenshot ? t('mcp.capturing') : t('mcp.screenshot')}
          </button>
        </div>
        {fetchError && <span className={styles.errorText}>{fetchError}</span>}
      </div>
    </div>
  );
};

export default FigmaMcpPanel;
