import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Mod, ModFile } from "../types/mod";
import { formatBytes } from "../utils/format";
import { Toast } from "./Toast";

interface Props {
    mod: Mod;
    onClose: () => void;
}

type Status = "downloading" | "paused" | "ready" | null;

export function DownloadModal({ mod, onClose }: Props) {
    const [files, setFiles] = useState<ModFile[]>([]);
    const [loading, setLoading] = useState(true);

    const [downloading, setDownloading] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>(null);

    const [progress, setProgress] = useState(0);
    const [activeModId, setActiveModId] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);

    const [selectedFile, setSelectedFile] = useState<ModFile | null>(null);

    useEffect(() => {
        const progressUnlisten = listen<[string, number]>(
            "download-progress",
            (event) => {
                const [modId, percent] = event.payload;

                if (modId === String(mod._idRow)) {
                    setProgress(percent);
                }
            },
        );

        const completeUnlisten = listen<string>(
            "download-complete",
            (event) => {
                if (event.payload === String(mod._idRow)) {
                    setNotification("Mod installed successfully");
                    setStatus("ready");

                    setDownloading(null);
                    setActiveModId(null);
                    setProgress(100);
                }
            },
        );

        const failedUnlisten = listen<string>("download-failed", (event) => {
            if (event.payload === String(mod._idRow)) {
                setNotification("Download failed");
                setStatus(null);

                setDownloading(null);
                setActiveModId(null);
                setProgress(0);
            }
        });

        return () => {
            progressUnlisten.then((u) => u());
            completeUnlisten.then((u) => u());
            failedUnlisten.then((u) => u());
        };
    }, [mod._idRow]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `https://gamebanana.com/apiv11/Mod/${mod._idRow}/DownloadPage`,
                );
                const data = await res.json();
                setFiles(data._aFiles ?? []);
                setSelectedFile(data._aFiles?.[0] ?? null);
            } catch {
                setNotification("Failed to fetch download list");
            } finally {
                setLoading(false);
            }
        })();
    }, [mod._idRow]);

    const handleDownload = async (file: ModFile) => {
        try {
            setDownloading(file._sDownloadUrl);
            setActiveModId(String(mod._idRow));
            setStatus("downloading");
            setProgress(0);
            setSelectedFile(file);

            await invoke("download_mod", {
                url: file._sDownloadUrl,
                modId: String(mod._idRow),
            });

            setNotification("Mod installed successfully");
            setStatus("ready");
        } catch (err) {
            setNotification(String(err));
            setStatus(null);
        } finally {
            setDownloading(null);
            setActiveModId(null);
            setProgress(0);
        }
    };

    const handlePause = async () => {
        await invoke("pause_download", {
            modId: String(mod._idRow),
        });
        setStatus("paused");
    };

    const handleResume = async () => {
        await invoke("resume_download", {
            modId: String(mod._idRow),
        });
        setStatus("downloading");
    };

    const handleStop = async () => {
        await invoke("stop_download", {
            modId: String(mod._idRow),
        });

        setStatus(null);
        setProgress(0);
        setDownloading(null);
        setActiveModId(null);
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
                            <h2 className="font-bold text-sm text-white">
                                {mod._sName}
                            </h2>
                            <p className="text-[11px] text-white/30 mt-0.5">
                                by {mod._aSubmitter._sName}
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="text-white/20 hover:text-white/70"
                        >
                            ✕
                        </button>
                    </div>

                    {activeModId && (
                        <div className="px-3 pt-3 space-y-2">
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#ff5cf0] transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            <p className="text-[10px] text-white/40">
                                {Math.round(progress)}%
                            </p>

                            <div className="flex gap-2">
                                {status === "downloading" && (
                                    <button
                                        onClick={handlePause}
                                        className="px-3 py-1 text-[10px] bg-yellow-500 text-black rounded"
                                    >
                                        PAUSE
                                    </button>
                                )}

                                {status === "paused" && (
                                    <button
                                        onClick={handleResume}
                                        className="px-3 py-1 text-[10px] bg-green-500 text-black rounded"
                                    >
                                        RESUME
                                    </button>
                                )}

                                {status && (
                                    <button
                                        onClick={handleStop}
                                        className="px-3 py-1 text-[10px] bg-red-500 text-black rounded"
                                    >
                                        STOP
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

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
                                        className={`bg-white/3 border rounded-xl p-3 flex items-center justify-between gap-3 transition ${
                                            selectedFile?._idRow === file._idRow
                                                ? "border-[#ff5cf0]/50"
                                                : "border-white/6"
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-[12px] text-white/80 truncate">
                                                {file._sFile}
                                            </p>

                                            <div className="flex gap-1.5 mt-1">
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
                                            onClick={() => handleDownload(file)}
                                            className="px-3 py-1.5 bg-[#ff5cf0] text-black text-[10px] font-black rounded-lg disabled:opacity-50"
                                        >
                                            {isDownloading ? "..." : "GET"}
                                        </button>
                                    </div>
                                );
                            })}
                    </div>

                    <div className="p-3 pt-0">
                        <button
                            onClick={onClose}
                            className="w-full py-2 border border-white/6 text-white/30 text-xs rounded-xl"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
