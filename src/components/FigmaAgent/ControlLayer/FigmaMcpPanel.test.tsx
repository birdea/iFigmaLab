import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import FigmaMcpPanel from './FigmaMcpPanel';

// Mock useFigmaAuth hook
const mockLogin = jest.fn();
const mockLogout = jest.fn();
let mockIsAuthenticated = false;
let mockAccessToken = '';

jest.mock('../../../hooks/useFigmaAuth', () => ({
    useFigmaAuth: () => ({
        isAuthenticated: mockIsAuthenticated,
        accessToken: mockAccessToken,
        userInfo: null,
        login: mockLogin,
        logout: mockLogout,
    }),
}));

// Mock figmaApi
jest.mock('../../../services/figmaApi', () => ({
    fetchDesignContext: jest.fn(),
    fetchScreenshot: jest.fn(),
    checkMcpStatus: jest.fn(),
}));

import { fetchDesignContext, fetchScreenshot } from '../../../services/figmaApi';

describe('FigmaMcpPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsAuthenticated = false;
        mockAccessToken = '';
    });

    const renderComponent = () => {
        return render(
            <Provider>
                <FigmaMcpPanel />
            </Provider>
        );
    };

    it('renders the panel title', () => {
        renderComponent();
        expect(screen.getByText('Figma MCP 연동')).toBeInTheDocument();
    });

    it('shows sign in button when not authenticated', () => {
        renderComponent();
        expect(screen.getByText('Figma로 로그인')).toBeInTheDocument();
    });

    it('calls login when sign in button is clicked', () => {
        renderComponent();
        fireEvent.click(screen.getByText('Figma로 로그인'));
        expect(mockLogin).toHaveBeenCalled();
    });

    it('shows authenticated state and sign out button when authenticated', () => {
        mockIsAuthenticated = true;
        mockAccessToken = 'test-token';
        renderComponent();
        expect(screen.getByText('인증됨')).toBeInTheDocument();
        expect(screen.getByText('로그아웃')).toBeInTheDocument();
    });

    it('calls logout when sign out button is clicked', () => {
        mockIsAuthenticated = true;
        mockAccessToken = 'test-token';
        renderComponent();
        fireEvent.click(screen.getByText('로그아웃'));
        expect(mockLogout).toHaveBeenCalled();
    });

    it('disables fetch buttons when not authenticated', () => {
        renderComponent();
        const fetchBtn = screen.getByText('데이터 가져오기');
        expect(fetchBtn).toBeDisabled();
    });

    it('displays error when empty URL is submitted', async () => {
        mockIsAuthenticated = true;
        mockAccessToken = 'test-token';
        renderComponent();

        const fetchBtn = screen.getByText('데이터 가져오기');
        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(screen.getByText('Figma URL을 입력해주세요.')).toBeInTheDocument();
        });
    });

    it('displays error when invalid URL is submitted', async () => {
        mockIsAuthenticated = true;
        mockAccessToken = 'test-token';
        renderComponent();

        const urlInput = screen.getByPlaceholderText(/figma\.com\/design/);
        fireEvent.change(urlInput, { target: { value: 'not-a-figma-url' } });

        const fetchBtn = screen.getByText('데이터 가져오기');
        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(screen.getByText(/올바른 Figma URL을 입력해주세요/)).toBeInTheDocument();
        });
    });

    it('fetches context successfully with valid Figma URL', async () => {
        mockIsAuthenticated = true;
        mockAccessToken = 'test-token';
        (fetchDesignContext as jest.Mock).mockResolvedValue({ data: 'mocked context' });

        renderComponent();

        const urlInput = screen.getByPlaceholderText(/figma\.com\/design/);
        fireEvent.change(urlInput, {
            target: { value: 'https://www.figma.com/design/abc123/MyDesign?node-id=22041-218191' },
        });

        const fetchBtn = screen.getByText('데이터 가져오기');
        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(fetchDesignContext).toHaveBeenCalledWith(
                'https://www.figma.com/design/abc123/MyDesign?node-id=22041-218191',
                'test-token',
            );
        });
    });

    it('displays error when context fetch fails', async () => {
        mockIsAuthenticated = true;
        mockAccessToken = 'test-token';
        (fetchDesignContext as jest.Mock).mockRejectedValue(new Error('Network error'));

        renderComponent();

        const urlInput = screen.getByPlaceholderText(/figma\.com\/design/);
        fireEvent.change(urlInput, {
            target: { value: 'https://www.figma.com/design/abc123/MyDesign?node-id=22041-218191' },
        });

        const fetchBtn = screen.getByText('데이터 가져오기');
        fireEvent.click(fetchBtn);

        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });
    });

    it('fetches screenshot successfully', async () => {
        mockIsAuthenticated = true;
        mockAccessToken = 'test-token';
        (fetchScreenshot as jest.Mock).mockResolvedValue({ data: 'base64data', mimeType: 'image/png' });

        renderComponent();

        const urlInput = screen.getByPlaceholderText(/figma\.com\/design/);
        fireEvent.change(urlInput, {
            target: { value: 'https://www.figma.com/design/abc123/MyDesign?node-id=1-2' },
        });

        const screenshotBtn = screen.getByText('스크린샷');
        fireEvent.click(screenshotBtn);

        await waitFor(() => {
            expect(fetchScreenshot).toHaveBeenCalledWith(
                'https://www.figma.com/design/abc123/MyDesign?node-id=1-2',
                'test-token',
            );
        });
    });
});
