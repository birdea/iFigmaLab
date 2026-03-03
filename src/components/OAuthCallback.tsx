import React, { useEffect, useState } from 'react';
import { exchangeToken } from '../services/figmaOAuth';

/**
 * OAuth callback 페이지 (팝업 내에서 렌더링).
 * URL에서 authorization code를 추출하여 토큰 교환 후 부모 창에 전달합니다.
 */
const OAuthCallback: React.FC = () => {
  const [status, setStatus] = useState('처리 중...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setStatus(`오류: ${error}`);
      return;
    }

    if (!code || !state) {
      setStatus('인증 코드가 없습니다.');
      return;
    }

    // sessionStorage에서 PKCE state 검증
    const savedRaw = sessionStorage.getItem('figma_oauth_state');
    // 팝업에서는 부모의 sessionStorage에 접근 불가할 수 있으므로
    // opener를 통해 전달도 시도

    const handleExchange = async () => {
      // 방법 1: postMessage로 부모에 code 전달 (부모가 토큰 교환)
      if (window.opener) {
        try {
          window.opener.postMessage(
            { type: 'figma-oauth-callback', code, state },
            window.location.origin,
          );
          setStatus('인증 완료! 이 창은 자동으로 닫힙니다.');
          setTimeout(() => window.close(), 1000);
          return;
        } catch (e) {
          console.warn('[OAuthCallback] postMessage failed:', e);
        }
      }

      // 방법 2: 직접 토큰 교환 (팝업이 아닌 동일 탭에서 리다이렉트된 경우)
      if (savedRaw) {
        try {
          setStatus('토큰 교환 중...');
          const saved = JSON.parse(savedRaw);

          if (state !== saved.state) {
            setStatus('State 불일치 오류');
            return;
          }

          const tokens = await exchangeToken(code, saved.codeVerifier);
          sessionStorage.removeItem('figma_oauth_state');

          // localStorage에 직접 저장 (atomWithStorage 호환)
          localStorage.setItem('figmaAccessToken', JSON.stringify(tokens.access_token));
          localStorage.setItem('figmaRefreshToken', JSON.stringify(tokens.refresh_token));

          setStatus('인증 완료! 메인 페이지로 이동합니다.');
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setStatus(`토큰 교환 실패: ${msg}`);
        }
      } else {
        setStatus('인증 상태를 찾을 수 없습니다. 다시 로그인해주세요.');
      }
    };

    handleExchange();
  }, []);

  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <p>{status}</p>
    </div>
  );
};

export default OAuthCallback;
