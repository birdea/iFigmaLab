import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// Dynamic loading을 지원하기 위해 string 타입으로 정의
export type GeminiModel = string;

export interface GeminiModelEntry { id: string; label: string; tier: string }

export const GEMINI_MODELS_DEFAULT: GeminiModelEntry[] = [
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', tier: '최고 성능 — 복잡한 추론·코딩' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: '기본값 — 속도·비용 균형' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', tier: '저비용·저지연' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', tier: '안정' },
];

export const DEFAULT_MODEL: GeminiModel = 'gemini-2.5-flash';

// API Key — AgentSetupPanel.tsx에서 LocalStorage 암호화 보관 담당
export const apiKeyAtom = atom<string>('');

// 현재 선택된 Model
export const selectedModelAtom = atom<GeminiModel>(DEFAULT_MODEL);

// 동적으로 Fetch한 Model 리스트 (초기값은 하드코딩된 리스트)
export const geminiModelsAtom = atom<GeminiModelEntry[]>(GEMINI_MODELS_DEFAULT);

// Figma OAuth
export const figmaAccessTokenAtom = atomWithStorage<string>('figmaAccessToken', '');
export const figmaRefreshTokenAtom = atomWithStorage<string>('figmaRefreshToken', '');
export const figmaUserInfoAtom = atom<{ email: string; name: string } | null>(null);

// Figma URL (전체 URL 저장 — fileKey + nodeId 추출용)
export const figmaUrlAtom = atom<string>('');

// Figma MCP Connection 상태: true=연결됨, false=연결 안 됨, null=확인 불가
export const figmaConnectedAtom = atom<boolean | null>(null);

// MCP 데이터 입력
export const mcpDataAtom = atom<string>('');

// 추가 Prompt 설정
export const promptAtom = atom<string>('');

// Generation (생성) 상태
export type GenerateStatus = 'idle' | 'loading' | 'success' | 'error';
export const generateStatusAtom = atom<GenerateStatus>('idle');
export const generateErrorAtom = atom<string>('');

// 생성된 원본 HTML
export const generatedHtmlAtom = atom<string>('');
export const rawResponseAtom = atom<string>('');

// Source 패널 UI 노출 여부
export const showSourceAtom = atom<boolean>(false);

// Debug 로그 데이터
export const debugLogAtom = atom<string>('');

// 화면 캡처 이미지 (Base64 data + MimeType)
export const screenshotAtom = atom<string>('');
export const screenshotMimeTypeAtom = atom<string>('image/png');

// Model 정보 조회 텍스트
export const modelInfoTextAtom = atom<string>('');

export const isLockedAtom = atom<boolean>(false);
export const savedEncryptedKeyAtom = atom<string>('');
export const pinAtom = atom<string>('');
export const rememberKeyAtom = atom<boolean>(false);

// Security: PIN attempts and lockout
export const unlockAttemptsAtom = atom<number>(0);
export const lockedUntilAtom = atom<number>(0);
