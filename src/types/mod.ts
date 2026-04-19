export interface ModFile {
    _idRow: number;
    _sFile: string;
    _nFilesize: number;
    _nDownloadCount: number;
    _sDownloadUrl: string;
    _sVersion: string;
    _sDescription: string;
}

export interface Mod {
    _idRow: number;
    _sName: string;
    _aSubmitter: { _sName: string };
    _aPreviewMedia: {
        _aImages: Array<{
            _sBaseUrl: string;
            _sFile220: string;
        }>;
    };
    _nLikeCount?: number;
    _nViewCount?: number;
    _nPostCount?: number;
    _bWasFeatured?: boolean;
}
