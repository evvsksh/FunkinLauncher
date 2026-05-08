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

type Notification = {
    message: string;
    type?: "error" | "success";
} | null;

export function DownloadModal({ mod, onClose }: Props) {
    const [files, setFiles] = useState<ModFile[]>([]);
    const [loading, setLoading] = useState(true);

    const [downloading, setDownloading] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>(null);
    const [progress, setProgress] = useState(0);

    const [notification, setNotification] = useState<Notification>(null);
    const [selectedFile, setSelectedFile] = useState<ModFile | null>(null);

    const modId = String(mod._idRow);

    useEffect(() => {
        (async () => {
            try {
                const state = await invoke<any>("get_download_state", {
                    modId,
                });

                if (state?.active) {
                    setStatus(state.paused ? "paused" : "downloading");
                    setProgress(Number(state.progress ?? 0));
                    setDownloading(state.url ?? null);
                } else {
                    setStatus(null);
                    setProgress(0);
                    setDownloading(null);
                }
            } catch {}
        })();
    }, [modId]);

    useEffect(() => {
        const progressUnlisten = listen<[string, number]>(
            "download-progress",
            (event) => {
                const [eventModId, percent] = event.payload;
                if (eventModId === modId) {
                    setProgress(Number(percent));
                }
            },
        );

        const completeUnlisten = listen<string>(
            "download-complete",
            (event) => {
                if (event.payload === modId) {
                    setNotification({ message: "Mod installed successfully" });
                    setStatus("ready");
                    setDownloading(null);
                    setProgress(100);
                }
            },
        );

        const failedUnlisten = listen<string>("download-failed", (event) => {
            if (event.payload === modId) {
                setNotification({ message: "Download failed", type: "error" });
                setStatus(null);
                setDownloading(null);
                setProgress(0);
            }
        });

        return () => {
            progressUnlisten.then((u) => u());
            completeUnlisten.then((u) => u());
            failedUnlisten.then((u) => u());
        };
    }, [modId]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(
                    `https://gamebanana.com/apiv11/Mod/${modId}/DownloadPage`,
                );

                const data = await res.json();

                setFiles(data._aFiles ?? []);
                setSelectedFile(data._aFiles?.[0] ?? null);
            } catch {
                setNotification({
                    message: "Failed to fetch download list",
                    type: "error",
                });
            } finally {
                setLoading(false);
            }
        })();
    }, [modId]);

    const handleDownload = async (file: ModFile) => {
        try {
            setDownloading(file._sDownloadUrl);
            setStatus("downloading");
            setProgress(0);
            setSelectedFile(file);

            await invoke("download_mod", {
                url: file._sDownloadUrl,
                modId,
            });
        } catch (err) {
            setNotification({ message: String(err), type: "error" });
            setStatus(null);
            setDownloading(null);
            setProgress(0);
        }
    };

    const handlePause = async () => {
        await invoke("pause_download", { modId });
        setStatus("paused");
    };

    const handleResume = async () => {
        await invoke("resume_download", { modId });
        setStatus("downloading");
    };

    const handleStop = async () => {
        await invoke("stop_download", { modId });
        setStatus(null);
        setProgress(0);
        setDownloading(null);
    };

    const displayProgress = Number(progress.toFixed(2));

    return (
        <>
            {notification && (
                <Toast
                    message={notification.message}
                    type={notification.type}
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
                        <h2 className="text-white font-bold text-lg">
                            {mod._sName}
                        </h2>

                        <p className="text-white/35 text-xs mt-1">
                            by {mod._aSubmitter._sName}
                        </p>

                        {status && (
                            <div className="mt-5 space-y-3">
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-pink-500 to-fuchsia-400 transition-all duration-300"
                                        style={{ width: `${displayProgress}%` }}
                                    />
                                </div>

                                <div className="flex justify-between text-xs text-white/60">
                                    <span>{status}</span>
                                    <span>{displayProgress.toFixed(2)}%</span>
                                </div>

                                <div className="flex gap-2">
                                    {status === "downloading" && (
                                        <button onClick={handlePause}>
                                            Pause
                                        </button>
                                    )}

                                    {status === "paused" && (
                                        <button onClick={handleResume}>
                                            Resume
                                        </button>
                                    )}

                                    {status && status !== "ready" && (
                                        <button onClick={handleStop}>
                                            Stop
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 space-y-3 max-h-105 overflow-y-auto">
                        {loading && (
                            <div className="py-10 text-center text-white/40">
                                Loading...
                            </div>
                        )}

                        {!loading &&
                            files.map((file) => {
                                const isDownloading =
                                    downloading === file._sDownloadUrl;

                                return (
                                    <div
                                        key={file._idRow}
                                        className="p-4 rounded-xl border border-white/10"
                                    >
                                        <div className="flex justify-between">
                                            <div>
                                                <p className="text-white">
                                                    {file._sFile}
                                                </p>

                                                <p className="text-xs text-white/40">
                                                    {formatBytes(
                                                        file._nFilesize,
                                                    )}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() =>
                                                    handleDownload(file)
                                                }
                                                disabled={isDownloading}
                                            >
                                                {isDownloading
                                                    ? "Downloading..."
                                                    : "Download"}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>

                    <div className="p-4 border-t border-white/10">
                        <button
                            onClick={onClose}
                            className="w-full text-white/70"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
