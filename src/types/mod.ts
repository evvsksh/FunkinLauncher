export interface ModFile {
    _idRow: number;
    _sFile: string;
    _nFilesize: number;
    _nDownloadCount: number;
    _sDownloadUrl: string;
    _sVersion: string;
    _sDescription: string;
}

export interface ModImage {
    _sBaseUrl: string;
    _sFile100: string;
    _sFile220: string;
    _sFile530: string;
    _sFile800: string;
}

export interface ModSubmitter {
    _sName: string;
}

export interface ModPreviewMedia {
    _aImages: ModImage[];
}

export interface Mod {
    _idRow: number;
    _sName: string;
    _aSubmitter: ModSubmitter;
    _aPreviewMedia: ModPreviewMedia;

    _nLikeCount?: number;
    _nViewCount?: number;
    _nPostCount?: number;
    _bWasFeatured?: boolean;

    _aFiles?: ModFile[];
}
