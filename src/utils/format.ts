export function formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getModImage(mod: {
    _aPreviewMedia: {
        _aImages: Array<{ _sBaseUrl: string; _sFile220: string }>;
    };
}): string | null {
    try {
        const img = mod._aPreviewMedia._aImages[0];
        return `${img._sBaseUrl}/${img._sFile220}`;
    } catch {
        return null;
    }
}
