import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["dist/**", "coverage/**", "node_modules/**"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    // N-19: jsx-a11y 접근성 규칙 추가
    jsxA11y.flatConfigs.recommended,
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        plugins: {
            "react-hooks": reactHooks
        },
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            // 접근성 규칙 (N-19)
            "jsx-a11y/alt-text": "error",
            "jsx-a11y/aria-role": "error",
            "jsx-a11y/aria-props": "error",
            "jsx-a11y/aria-unsupported-elements": "error",
            "jsx-a11y/interactive-supports-focus": "warn",
            "jsx-a11y/click-events-have-key-events": "warn",
            "jsx-a11y/no-static-element-interactions": "warn",
            // 코드 품질 규칙
            "no-console": ["warn", { "allow": ["warn", "error"] }],
            "prefer-const": "error"
        }
    },
    // webpack.config.js 는 CommonJS 환경 — require() 허용
    {
        files: ["webpack.config.js"],
        rules: {
            "@typescript-eslint/no-require-imports": "off"
        }
    },
    // Node scripts use CommonJS and console output intentionally
    {
        files: ["scripts/**/*.js"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
            "no-console": "off"
        }
    },
    // Jest 테스트 및 셋업 파일 — require(), any 타입 허용
    {
        files: ["**/*.test.{ts,tsx}", "**/setupTests.ts"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-explicit-any": "off"
        }
    }
);
