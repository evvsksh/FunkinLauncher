import { createPortal } from "react-dom";

export function DownloadPanel({
    downloads,
    getProgress,
    getStatus,
    pauseDownload,
    resumeDownload,
    stopDownload,
    onClose,
}: any) {
    return createPortal(
        <div
            className="fixed inset-0 z-9999 bg-black/75 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0715] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 border-b border-white/[0.07] flex items-center justify-between">
                    <h2 className="text-white font-black text-base">
                        Downloads
                    </h2>

                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
                    >
                        ×
                    </button>
                </div>

                <div className="p-3 max-h-80 overflow-y-auto flex flex-col gap-2">
                    {Object.keys(downloads).length === 0 && (
                        <div className="py-10 text-center text-white/30 text-sm font-semibold">
                            No active downloads
                        </div>
                    )}

                    {Object.values(downloads).map((d: any) => {
                        const progress = getProgress(d.downloadId);
                        const status = getStatus(d.downloadId);

                        return (
                            <div
                                key={d.downloadId}
                                className="p-3 rounded-2xl border border-white/10 bg-white/5"
                            >
                                <div className="text-white text-sm font-bold truncate">
                                    {d.file?._sFile ?? "Unknown file"}
                                </div>

                                <div className="mt-2 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-linear-to-r from-pink-500 to-fuchsia-500 transition-all"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                <div className="flex justify-between mt-2 text-[11px] text-white/40">
                                    <span className="uppercase font-semibold">
                                        {status}
                                    </span>
                                    <span className="text-white/70 font-black">
                                        {progress.toFixed(1)}%
                                    </span>
                                </div>

                                <div className="flex gap-2 mt-3">
                                    {status === "downloading" && (
                                        <button
                                            onClick={() =>
                                                pauseDownload(d.downloadId)
                                            }
                                            className="px-3 py-1.5 bg-white/10 rounded-lg text-xs font-bold text-white"
                                        >
                                            Pause
                                        </button>
                                    )}

                                    {status === "paused" && (
                                        <button
                                            onClick={() =>
                                                resumeDownload(d.downloadId)
                                            }
                                            className="px-3 py-1.5 bg-white/10 rounded-lg text-xs font-bold text-white"
                                        >
                                            Resume
                                        </button>
                                    )}

                                    {status !== "downloaded" && (
                                        <button
                                            onClick={() =>
                                                stopDownload(d.downloadId)
                                            }
                                            className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold"
                                        >
                                            Stop
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-3 border-t border-white/[0.07]">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 text-white/40 text-sm font-bold hover:text-white/70"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
