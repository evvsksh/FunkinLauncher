import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Mod, ModFile } from "../types/mod";
import { formatBytes } from "../utils/format";
import { Toast } from "./Notification";
import { useDownloads } from "../context/DownloadManagerContext";
interface Props {
    mod: Mod;
    onClose: () => void;
}

type Notification = {
    message: string;
    type?: "error" | "success";
} | null;

export function DownloadModal({ mod, onClose }: Props) {
    const [files, setFiles] = useState<ModFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<Notification>(null);

    const {
        downloads,
        pauseDownload,
        resumeDownload,
        stopDownload,
        startDownload,
    } = useDownloads();

    const modId = mod._idRow.toString();

    const activeDownloads = Object.values(downloads).filter(
        (d) => d.modId === modId,
    );

    const mainDownload = activeDownloads[0];

    const status = mainDownload?.status ?? "idle";
    const progress = mainDownload?.progress ?? 0;
    const displayProgress = progress;

    useEffect(() => {
        (async () => {
            try {
                await invoke<any>("get_download_state", { modId });
            } catch {}

            try {
                const res = await fetch(
                    `https://gamebanana.com/apiv11/Mod/${mod._idRow}/DownloadPage`,
                );

                const data = await res.json();
                setFiles(data._aFiles ?? []);
            } catch {
                setNotification({
                    message: "Failed to fetch download list",
                    type: "error",
                });
            } finally {
                setLoading(false);
            }
        })();
    }, [modId, mod._idRow]);

    const handleDownload = async (file: ModFile) => {
        try {
            await startDownload(mod, file);
        } catch {
            setNotification({
                message: "Download failed",
                type: "error",
            });
        }
    };

    const handlePause = () => {
        if (!mainDownload) return;
        pauseDownload(mainDownload.downloadId);
    };

    const handleResume = () => {
        if (!mainDownload) return;
        resumeDownload(mainDownload.downloadId);
    };

    const handleStop = () => {
        if (!mainDownload) return;
        stopDownload(mainDownload.downloadId);
    };

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
                className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0715] overflow-hidden shadow-2xl"
                >
                    <div className="p-5 border-b border-white/10">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-white font-black text-base leading-tight">
                                    {mod._sName}
                                </h2>
                                <p className="text-white/35 text-[11px] mt-0.5">
                                    {mod._aSubmitter._sName}
                                </p>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/6 border border-white/10 flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/10"
                            >
                                ×
                            </button>
                        </div>

                        {mainDownload && (
                            <div className="mt-4 space-y-1.5">
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-linear-to-r from-pink-500 to-fuchsia-500 rounded-full transition-all"
                                        style={{ width: `${displayProgress}%` }}
                                    />
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-[11px] text-white/45 font-semibold uppercase">
                                        {status}
                                    </span>
                                    <span className="text-[11px] text-white/70 font-black">
                                        {displayProgress.toFixed(2)}%
                                    </span>
                                </div>

                                <div className="flex gap-1.5 mt-2.5">
                                    {status === "downloading" && (
                                        <button
                                            onClick={handlePause}
                                            className="px-3 py-1.5 bg-white/10 rounded-lg text-xs font-bold"
                                        >
                                            Pause
                                        </button>
                                    )}

                                    {status === "paused" && (
                                        <button
                                            onClick={handleResume}
                                            className="px-3 py-1.5 bg-white/10 rounded-lg text-xs font-bold"
                                        >
                                            Resume
                                        </button>
                                    )}

                                    {status !== "downloaded" &&
                                        status !== "idle" && (
                                            <button
                                                onClick={handleStop}
                                                className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold"
                                            >
                                                Stop
                                            </button>
                                        )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-3 flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                        {loading && (
                            <div className="py-10 text-center text-white/30 text-sm font-semibold">
                                Loading files...
                            </div>
                        )}

                        {!loading &&
                            files.map((file) => {
                                const downloadId = `${mod._idRow}-${file._idRow ?? file._sDownloadUrl}`;
                                const d = downloads[downloadId];

                                return (
                                    <div
                                        key={file._idRow}
                                        className="flex items-center justify-between p-3 rounded-2xl border border-white/10 bg-white/5"
                                    >
                                        <div>
                                            <p className="text-white text-[13px] font-bold">
                                                {file._sFile}
                                            </p>
                                            <p className="text-white/35 text-[11px]">
                                                {formatBytes(file._nFilesize)}
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => handleDownload(file)}
                                            disabled={
                                                !!d &&
                                                d.status === "downloading"
                                            }
                                            className="px-3 py-1.5 bg-linear-to-br from-pink-500 to-fuchsia-600 rounded-[9px] text-white text-xs font-black disabled:opacity-40"
                                        >
                                            {d ? d.status : "Download"}
                                        </button>
                                    </div>
                                );
                            })}
                    </div>

                    <div className="p-3 border-t border-white/10">
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 text-white/40 text-[13px] font-bold"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
