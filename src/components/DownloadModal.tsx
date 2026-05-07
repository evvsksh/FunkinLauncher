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

function PauseIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
    );
}

function PlayIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
        </svg>
    );
}

function StopIcon() {
    return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
    );
}

function DownloadIcon() {
    return (
        <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <path d="M12 3v12" strokeLinecap="round" />
            <path
                d="M7 11l5 5 5-5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path d="M5 21h14" strokeLinecap="round" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
        >
            <path
                d="M5 13l4 4L19 7"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

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
        } catch (err) {
            setNotification(String(err));

            setStatus(null);
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
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0715] overflow-hidden shadow-2xl"
                >
                    <div className="p-5 border-b border-white/6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-white font-bold text-lg">
                                    {mod._sName}
                                </h2>

                                <p className="text-white/35 text-xs mt-1">
                                    by {mod._aSubmitter._sName}
                                </p>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
                            >
                                ✕
                            </button>
                        </div>

                        {activeModId && (
                            <div className="mt-5 space-y-3">
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-linear-to-r from-pink-500 to-fuchsia-400 transition-all duration-300"
                                        style={{
                                            width: `${progress}%`,
                                        }}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-white/40 uppercase tracking-wider">
                                        {status}
                                    </span>

                                    <span className="text-[11px] text-white/60">
                                        {Math.round(progress)}%
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    {status === "downloading" && (
                                        <button
                                            onClick={handlePause}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25 transition text-xs font-semibold"
                                        >
                                            <PauseIcon />
                                            Pause
                                        </button>
                                    )}

                                    {status === "paused" && (
                                        <button
                                            onClick={handleResume}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/15 text-green-300 hover:bg-green-500/25 transition text-xs font-semibold"
                                        >
                                            <PlayIcon />
                                            Resume
                                        </button>
                                    )}

                                    {status && status !== "ready" && (
                                        <button
                                            onClick={handleStop}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 text-red-300 hover:bg-red-500/25 transition text-xs font-semibold"
                                        >
                                            <StopIcon />
                                            Stop
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="max-h-105 overflow-y-auto p-4 space-y-3">
                        {loading && (
                            <div className="flex justify-center py-14">
                                <div className="w-8 h-8 border-2 border-fuchsia-500/20 border-t-fuchsia-400 rounded-full animate-spin" />
                            </div>
                        )}

                        {!loading &&
                            files.map((file) => {
                                const isDownloading =
                                    downloading === file._sDownloadUrl;

                                const isSelected =
                                    selectedFile?._idRow === file._idRow;

                                return (
                                    <div
                                        key={file._idRow}
                                        className={`rounded-2xl border p-4 transition-all ${
                                            isSelected
                                                ? "border-fuchsia-500/40 bg-fuchsia-500/5"
                                                : "border-white/6 bg-white/2"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-sm text-white font-medium truncate">
                                                    {file._sFile}
                                                </p>

                                                <div className="flex items-center gap-2 mt-1 text-[11px] text-white/35">
                                                    <span>
                                                        {formatBytes(
                                                            file._nFilesize,
                                                        )}
                                                    </span>

                                                    {file._sVersion && (
                                                        <>
                                                            <span>•</span>

                                                            <span>
                                                                v
                                                                {file._sVersion}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                disabled={isDownloading}
                                                onClick={() =>
                                                    handleDownload(file)
                                                }
                                                className={`h-11 px-4 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold text-xs ${
                                                    status === "ready" &&
                                                    isSelected
                                                        ? "bg-green-500/15 text-green-300"
                                                        : "bg-fuchsia-500 text-black hover:bg-fuchsia-400"
                                                } disabled:opacity-50`}
                                            >
                                                {status === "ready" &&
                                                isSelected ? (
                                                    <>
                                                        <CheckIcon />
                                                        Installed
                                                    </>
                                                ) : isDownloading ? (
                                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <DownloadIcon />
                                                        Download
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>

                    <div className="p-4 border-t border-white/6">
                        <button
                            onClick={onClose}
                            className="w-full h-11 rounded-2xl border border-white/8 bg-white/5 hover:bg-white/8 text-white/70 text-sm font-medium transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
