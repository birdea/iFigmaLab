import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { screenshotAtom, screenshotMimeTypeAtom } from './atoms';
import styles from './FigmaAgent.module.scss';

const ExpandIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M9 1h4v4M5 13H1V9M1 5V1h4M13 9v4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ScreenshotSidePanel: React.FC = () => {
  const { t } = useTranslation();
  const [screenshot, setScreenshot] = useAtom(screenshotAtom);
  const [screenshotMimeType] = useAtom(screenshotMimeTypeAtom);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const closeFullscreen = useCallback(() => setIsFullscreen(false), []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFullscreen();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen, closeFullscreen]);

  if (!screenshot) return null;

  const imgSrc = `data:${screenshotMimeType};base64,${screenshot}`;

  return (
    <div className={styles.screenshotSidePanel}>
      <div className={styles.screenshotSidePanelHeader}>
        <span className={styles.screenshotLabel}>
          <span aria-hidden="true">📸</span> {t('mcp.screenshot_label')}
        </span>
        <div className={styles.screenshotHeaderActions}>
          <button
            className={styles.screenshotExpandBtn}
            onClick={() => setIsFullscreen(true)}
            type="button"
            aria-label={t('mcp.fullscreen')}
          >
            <ExpandIcon /> {t('mcp.fullscreen')}
          </button>
          <button
            className={styles.screenshotClear}
            onClick={() => setScreenshot('')}
            type="button"
          >
            <span aria-hidden="true">✕</span> {t('mcp.remove')}
          </button>
        </div>
      </div>

      <div className={styles.screenshotSideImgWrap}>
        <img
          className={styles.screenshotSideImg}
          src={imgSrc}
          alt={t('mcp.screenshot_alt')}
        />
      </div>

      {isFullscreen && (
        <div
          className={styles.screenshotFullscreenOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={t('mcp.screenshot_alt')}
        >
          <button
            className={styles.screenshotFullscreenBackdrop}
            onClick={closeFullscreen}
            type="button"
            aria-label={t('toast.close')}
          />
          <div className={styles.screenshotFullscreenContent}>
          <button
            className={styles.screenshotFullscreenClose}
            onClick={closeFullscreen}
            type="button"
            aria-label={t('toast.close')}
          >
            ✕
          </button>
          <img
            className={styles.screenshotFullscreenImg}
            src={imgSrc}
            alt={t('mcp.screenshot_alt')}
          />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenshotSidePanel;
