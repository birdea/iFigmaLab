import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import OAuthCallback from './components/OAuthCallback';
import ErrorBoundary from './components/ErrorBoundary';
import './i18n/config';
import { reportError } from './utils/errorReporter';

// 전역 에러 핸들러 — ErrorBoundary가 포착하지 못하는 비동기 오류 수집 및 지속 기록
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
  reportError('UnhandledRejection', event.reason);
});
window.addEventListener('error', (event) => {
  const err = event.error ?? new Error(event.message);
  console.error('[Global Error]', err);
  reportError('GlobalError', err);
});

const container = document.getElementById('root');
if (!container) {
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif; text-align: center;">
      <h1 style="color: #e74c3c;">Initialization Error</h1>
      <p>The root element '#root' was not found. The application cannot start.</p>
    </div>
  `;
  console.error('[Bootstrap] Root element not found');
} else {
  const root = createRoot(container);
  const isOAuthCallback = window.location.pathname === '/oauth/callback';
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        {isOAuthCallback ? <OAuthCallback /> : <App />}
      </ErrorBoundary>
    </React.StrictMode>
  );
}
