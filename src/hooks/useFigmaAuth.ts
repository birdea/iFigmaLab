import { useCallback, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import {
  figmaAccessTokenAtom,
  figmaRefreshTokenAtom,
  figmaUserInfoAtom,
} from '../components/FigmaAgent/atoms';
import {
  buildAuthUrl,
  exchangeToken,
  refreshAccessToken,
  type OAuthState,
} from '../services/figmaOAuth';
import { checkMcpStatus } from '../services/figmaApi';

const OAUTH_STATE_KEY = 'figma_oauth_state';
const OAUTH_CODE_KEY = 'figma_oauth_code';

export function useFigmaAuth() {
  const [accessToken, setAccessToken] = useAtom(figmaAccessTokenAtom);
  const [refreshToken, setRefreshToken] = useAtom(figmaRefreshTokenAtom);
  const [userInfo, setUserInfo] = useAtom(figmaUserInfoAtom);
  const popupRef = useRef<Window | null>(null);

  const isAuthenticated = !!accessToken;

  // OAuth 팝업 메시지 수신 처리
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, code, state } = event.data || {};
      if (type !== 'figma-oauth-callback') return;

      const savedRaw = sessionStorage.getItem(OAUTH_STATE_KEY);
      if (!savedRaw) return;

      const saved: OAuthState = JSON.parse(savedRaw);
      sessionStorage.removeItem(OAUTH_STATE_KEY);

      if (state !== saved.state) {
        console.error('[FigmaAuth] State mismatch');
        return;
      }

      try {
        const tokens = await exchangeToken(code, saved.codeVerifier);
        setAccessToken(tokens.access_token);
        setRefreshToken(tokens.refresh_token);
      } catch (e) {
        console.error('[FigmaAuth] Token exchange failed:', e);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setAccessToken, setRefreshToken]);

  // localStorage에 저장된 OAuth code 처리 (팝업 fallback)
  useEffect(() => {
    const codeRaw = localStorage.getItem(OAUTH_CODE_KEY);
    if (!codeRaw) return;

    localStorage.removeItem(OAUTH_CODE_KEY);

    const savedRaw = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (!savedRaw) return;

    const { code, state } = JSON.parse(codeRaw);
    const saved: OAuthState = JSON.parse(savedRaw);
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    if (state !== saved.state) {
      console.error('[FigmaAuth] State mismatch (localStorage fallback)');
      return;
    }

    exchangeToken(code, saved.codeVerifier)
      .then((tokens) => {
        setAccessToken(tokens.access_token);
        setRefreshToken(tokens.refresh_token);
      })
      .catch((e) => {
        console.error('[FigmaAuth] Token exchange failed (localStorage fallback):', e);
      });
  }, [setAccessToken, setRefreshToken]);

  // 토큰 유효성 확인 (마운트 시)
  useEffect(() => {
    if (!accessToken) return;

    checkMcpStatus(accessToken).then(({ connected }) => {
      if (!connected && refreshToken) {
        refreshAccessToken(refreshToken)
          .then((tokens) => {
            setAccessToken(tokens.access_token);
            setRefreshToken(tokens.refresh_token);
          })
          .catch(() => {
            setAccessToken('');
            setRefreshToken('');
            setUserInfo(null);
          });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async () => {
    const { url, oauthState } = await buildAuthUrl();
    sessionStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(oauthState));

    // 팝업으로 OAuth 페이지 열기
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;
    popupRef.current = window.open(
      url,
      'figma-oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`,
    );
  }, []);

  const logout = useCallback(() => {
    setAccessToken('');
    setRefreshToken('');
    setUserInfo(null);
  }, [setAccessToken, setRefreshToken, setUserInfo]);

  return {
    isAuthenticated,
    userInfo,
    accessToken,
    login,
    logout,
  };
}
