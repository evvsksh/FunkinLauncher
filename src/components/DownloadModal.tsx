import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Mod, ModFile } from "../types/mod";
import { formatBytes } from "../utils/format";
import { Toast } from "./Toast";

interface Props {
    mod: Mod;
    onClose: () => void;
}

export function DownloadModal({ mod, onClose }: Props) {
    const [files, setFiles] = useState<ModFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `https://gamebanana.com/apiv11/Mod/${mod._idRow}/DownloadPage`,
                );
                const data = await res.json();
                setFiles(data._aFiles ?? []);
            } catch {
                setNotification("Failed to fetch download list");
            } finally {
                setLoading(false);
            }
        })();
    }, [mod._idRow]);

    const handleDownload = async (url: string) => {
        try {
            setDownloading(url);

            await invoke("download_mod", {
                url,
                modId: String(mod._idRow),
            });

            setNotification("Mod installed successfully");
        } catch (err) {
            setNotification(String(err));
        } finally {
            setDownloading(null);
        }
    };

    return (
        <>
            {notification && (
                <Toast
                    message={notification}
                    onClose={() => setNotification(null)}
                />
            )}

            <div
                className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <div
                    className="bg-[#0d0a1a] border border-white/8 rounded-2xl w-full max-w-md relative overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-start justify-between p-5 border-b border-white/6">
                        <div>
                            <h2 className="font-bold text-sm text-white leading-snug max-w-75">
                                {mod._sName}
                            </h2>
                            <p className="text-[11px] text-white/30 mt-0.5">
                                by {mod._aSubmitter._sName}
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="text-white/20 hover:text-white/70 transition-colors ml-4 mt-0.5 shrink-0"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                        {loading && (
                            <div className="flex justify-center py-8">
                                <div className="w-6 h-6 border-2 border-[#ff5cf0]/20 border-t-[#ff5cf0] rounded-full animate-spin" />
                            </div>
                        )}

                        {!loading &&
                            files.map((file) => {
                                const isDownloading =
                                    downloading === file._sDownloadUrl;

                                return (
                                    <div
                                        key={file._idRow}
                                        className="bg-white/3 border border-white/6 rounded-xl p-3 flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-[12px] font-medium text-white/80 truncate">
                                                {file._sFile}
                                            </p>

                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                <span className="text-[10px] text-white/25">
                                                    {formatBytes(
                                                        file._nFilesize,
                                                    )}
                                                </span>

                                                {file._sVersion && (
                                                    <span className="text-[10px] text-white/25">
                                                        · v{file._sVersion}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            disabled={isDownloading}
                                            onClick={() =>
                                                handleDownload(
                                                    file._sDownloadUrl,
                                                )
                                            }
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#ff5cf0] hover:bg-[#ff80f4] active:scale-95 disabled:opacity-50 text-black font-black text-[10px] tracking-wide rounded-lg transition-all"
                                        >
                                            {isDownloading
                                                ? "INSTALLING"
                                                : "GET"}
                                        </button>
                                    </div>
                                );
                            })}
                    </div>

                    <div className="p-3 pt-0">
                        <button
                            onClick={onClose}
                            className="w-full py-2 border border-white/6 text-white/25 hover:text-white/50 text-xs rounded-xl transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
