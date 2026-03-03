import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import FigmaMcpPanel from './FigmaMcpPanel';

// Mock fetch for all test cases
global.fetch = jest.fn() as jest.Mock;

describe('FigmaMcpPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <Provider>
                <FigmaMcpPanel />
            </Provider>
        );
    };

    it('renders the component with default disconnected state', () => {
        renderComponent();
        expect(screen.getByText('Figma MCP 연동')).toBeInTheDocument();
        expect(screen.getByText('(○) : 연결 안 됨')).toBeInTheDocument();
    });

    it('checks status and updates connected state successfully', async () => {
        (global.fetch as jest.Mock).mockImplementation(async () => {
            return { ok: true, json: async () => ({ connected: true }) };
        });

        renderComponent();
        const applyBtn = screen.getByText('적용');
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(screen.getByText('(●) : 연결됨')).toBeInTheDocument();
        });
    });

    it('checks status and handles disconnected state if API fails', async () => {
        (global.fetch as jest.Mock).mockImplementation(async () => {
            throw new Error('Network error');
        });

        renderComponent();
        const applyBtn = screen.getByText('적용');
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(screen.getByText('(○) : 연결 안 됨')).toBeInTheDocument();
        });
    });

    it('fetches context context successfully given valid nodeId', async () => {
        (global.fetch as jest.Mock).mockImplementation(async (url) => {
            if (String(url).includes('/api/figma/status')) return { ok: true, json: async () => ({ connected: true }) };
            return { ok: true, text: async () => JSON.stringify({ data: 'mocked figma context' }) };
        });

        renderComponent();

        const nodeIdInput = screen.getByPlaceholderText(/22041:218191/);
        fireEvent.change(nodeIdInput, { target: { value: '1234:5678' } });

        const fetchBtn = screen.getByText('데이터 가져오기');
        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/figma/fetch-context'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"nodeId":"1234:5678"'),
                })
            );
        });
    });

    it('displays error message when empty nodeId is submitted for context fetch', async () => {
        renderComponent();

        const fetchBtn = screen.getByText('데이터 가져오기');
        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(screen.getByText('Node ID 또는 Figma URL을 입력해주세요.')).toBeInTheDocument();
        });
    });

    it('displays error message when invalid nodeId is submitted for context fetch', async () => {
        renderComponent();

        const nodeIdInput = screen.getByPlaceholderText(/22041:218191/);
        fireEvent.change(nodeIdInput, { target: { value: 'invalid-string' } });

        const fetchBtn = screen.getByText('데이터 가져오기');
        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(screen.getByText('올바른 Node ID(예: 22041:218191) 또는 Figma URL을 입력해주세요.')).toBeInTheDocument();
        });
    });

    it('fetch context handles network/server errors (Edge case)', async () => {
        (global.fetch as jest.Mock).mockImplementation(async (url) => {
            if (String(url).includes('/api/figma/status')) return { ok: true, json: async () => ({ connected: true }) };
            return { ok: false, status: 500, text: async () => JSON.stringify({ error: 'Internal Server Error' }) };
        });

        renderComponent();

        const nodeIdInput = screen.getByPlaceholderText(/22041:218191/);
        fireEvent.change(nodeIdInput, { target: { value: '1234:5678' } });

        const fetchBtn = screen.getByText('데이터 가져오기');
        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
        });
    });

    it('fetch context handles invalid JSON response (Edge case)', async () => {
        (global.fetch as jest.Mock).mockImplementation(async (url) => {
            if (String(url).includes('/api/figma/status')) return { ok: true, json: async () => ({ connected: true }) };
            return { ok: true, text: async () => '<html>Not JSON</html>' };
        });

        renderComponent();

        const nodeIdInput = screen.getByPlaceholderText(/22041:218191/);
        fireEvent.change(nodeIdInput, { target: { value: '1234:5678' } });

        const fetchBtn = screen.getByText('데이터 가져오기');
        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(screen.getByText(/서버 응답 오류 \(proxy-server 재시작 필요\)/)).toBeInTheDocument();
        });
    });

    it('fetches screenshot successfully', async () => {
        (global.fetch as jest.Mock).mockImplementation(async (url) => {
            if (String(url).includes('/api/figma/status')) return { ok: true, json: async () => ({ connected: true }) };
            return { ok: true, text: async () => JSON.stringify({ data: 'base64image', mimeType: 'image/jpeg' }) };
        });

        renderComponent();

        const applyBtn = screen.getByText('적용');
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(screen.getByText('(●) : 연결됨')).toBeInTheDocument();
        });

        const nodeIdInput = screen.getByPlaceholderText(/22041:218191/);
        fireEvent.change(nodeIdInput, { target: { value: '1234:5678' } });

        const screenshotBtn = screen.getByRole('button', { name: /스크린샷/ });
        fireEvent.click(screenshotBtn);

        await waitFor(() => {
            expect(screen.getByAltText('Figma 스크린샷')).toBeInTheDocument();
            expect(screen.getByAltText('Figma 스크린샷')).toHaveAttribute('src', 'data:image/jpeg;base64,base64image');
        });
    });

    it('fetch screenshot handles API error (Edge case)', async () => {
        (global.fetch as jest.Mock).mockImplementation(async (url) => {
            if (String(url).includes('/api/figma/status')) return { ok: true, json: async () => ({ connected: true }) };
            return { ok: false, text: async () => JSON.stringify({ error: 'Screenshot generation failed limit reached' }) };
        });

        renderComponent();

        const applyBtn = screen.getByText('적용');
        fireEvent.click(applyBtn);

        await waitFor(() => {
            expect(screen.getByText('(●) : 연결됨')).toBeInTheDocument();
        });

        const nodeIdInput = screen.getByPlaceholderText(/22041:218191/);
        fireEvent.change(nodeIdInput, { target: { value: '1234-5678' } }); // Valid alternative format

        const screenshotBtn = screen.getByRole('button', { name: /스크린샷/ });
        fireEvent.click(screenshotBtn);

        await waitFor(() => {
            expect(screen.getByText('Screenshot generation failed limit reached')).toBeInTheDocument();
        });
    });

    it('pauses polling when tab is hidden and resumes when visible', async () => {
        jest.useFakeTimers();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ connected: true }),
        });

        renderComponent();

        // Initial poll happens on mount
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const callCountAfterMount = (global.fetch as jest.Mock).mock.calls.length;

        // Hide tab
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
        fireEvent(document, new Event('visibilitychange'));

        // Advance timers - should NOT call fetch while hidden
        jest.advanceTimersByTime(20000);
        expect((global.fetch as jest.Mock).mock.calls.length).toBe(callCountAfterMount);

        // Show tab
        Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
        fireEvent(document, new Event('visibilitychange'));

        // Should resume polling
        jest.advanceTimersByTime(0);
        await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callCountAfterMount));

        jest.useRealTimers();
    });
});

