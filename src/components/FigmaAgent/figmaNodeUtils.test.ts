import { parseFigmaUrl } from './figmaNodeUtils';

describe('parseFigmaUrl', () => {
    it('extracts fileKey and nodeId from Figma design URL', () => {
        const url = 'https://www.figma.com/design/abc123/MyDesign?node-id=22041-218191';
        const result = parseFigmaUrl(url);
        expect(result).toEqual({
            fullUrl: url,
            fileKey: 'abc123',
            nodeId: '22041:218191',
        });
    });

    it('handles URL with additional query params', () => {
        const url = 'https://www.figma.com/design/XYZ789/SomeFile?node-id=1234-5678&mode=dev&t=abc';
        const result = parseFigmaUrl(url);
        expect(result).not.toBeNull();
        expect(result!.fileKey).toBe('XYZ789');
        expect(result!.nodeId).toBe('1234:5678');
    });

    it('handles www prefix', () => {
        const url = 'https://www.figma.com/design/abc123/MyDesign?node-id=100-200';
        const result = parseFigmaUrl(url);
        expect(result).not.toBeNull();
        expect(result!.fileKey).toBe('abc123');
        expect(result!.nodeId).toBe('100:200');
    });

    it('handles URL without www', () => {
        const url = 'https://figma.com/design/abc123/MyDesign?node-id=100-200';
        const result = parseFigmaUrl(url);
        expect(result).not.toBeNull();
        expect(result!.fileKey).toBe('abc123');
    });

    it('returns null for non-design URLs', () => {
        expect(parseFigmaUrl('https://www.figma.com/file/abc/MyDesign?node-id=1-2')).toBeNull();
        expect(parseFigmaUrl('https://www.google.com')).toBeNull();
        expect(parseFigmaUrl('')).toBeNull();
        expect(parseFigmaUrl('not a url')).toBeNull();
    });

    it('returns null for design URL without node-id', () => {
        const url = 'https://www.figma.com/design/abc123/MyDesign';
        expect(parseFigmaUrl(url)).toBeNull();
    });

    it('converts hyphen to colon in nodeId', () => {
        const url = 'https://www.figma.com/design/abc/File?node-id=5-10';
        const result = parseFigmaUrl(url);
        expect(result!.nodeId).toBe('5:10');
    });
});
