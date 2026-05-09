import { useDownloadManager } from "../hooks/downloadManager";

interface Props {
    open: boolean;
    onClose: () => void;
}

export function DownloadModal({ open, onClose }: Props) {
    const {
        downloads,
        getProgress,
        getStatus,
        pauseDownload,
        resumeDownload,
        stopDownload,
    } = useDownloadManager();

    if (!open) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0715] overflow-hidden shadow-2xl"
                >
                    {/* HEADER (same style as DownloadModal) */}
                    <div className="p-5 border-b border-white/[0.07]">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-white font-black text-base leading-tight">
                                    Downloads
                                </h2>
                                <p className="text-white/35 text-[11px] mt-0.5">
                                    Active transfers
                                </p>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/6 border border-white/10 flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/10"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    {/* LIST */}
                    <div className="p-3 flex flex-col gap-1.5 max-h-80 overflow-y-auto">
                        {Object.keys(downloads).length === 0 && (
                            <div className="py-10 text-center text-white/30 text-sm font-semibold">
                                No active downloads
                            </div>
                        )}

                        {Object.values(downloads).map((d: any) => {
                            const modId = d.downloadId;
                            const status = getStatus(modId);
                            const progress = getProgress(modId);
                            const displayProgress = Number(progress.toFixed(2));

                            return (
                                <div
                                    key={modId}
                                    className="p-3 rounded-2xl border border-white/10 bg-white/3"
                                >
                                    {/* TITLE */}
                                    <p className="text-white text-[13px] font-bold truncate">
                                        {d.file?._sFile ?? "Unknown file"}
                                    </p>

                                    {/* PROGRESS BAR */}
                                    {status !== "idle" && (
                                        <div className="mt-3 space-y-1.5">
                                            <div className="w-full h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-linear-to-r from-pink-500 to-fuchsia-500 rounded-full transition-all"
                                                    style={{
                                                        width: `${displayProgress}%`,
                                                    }}
                                                />
                                            </div>

                                            <div className="flex justify-between">
                                                <span className="text-[11px] text-white/45 font-semibold uppercase">
                                                    {status}
                                                </span>
                                                <span className="text-[11px] text-white/70 font-black">
                                                    {displayProgress.toFixed(2)}
                                                    %
                                                </span>
                                            </div>

                                            {/* ACTIONS (same style as your modal) */}
                                            <div className="flex gap-1.5 mt-2.5">
                                                {status === "downloading" && (
                                                    <button
                                                        onClick={() =>
                                                            pauseDownload(modId)
                                                        }
                                                        className="px-3 py-1.5 bg-white/10 rounded-lg text-xs font-bold"
                                                    >
                                                        Pause
                                                    </button>
                                                )}

                                                {status === "paused" && (
                                                    <button
                                                        onClick={() =>
                                                            resumeDownload(
                                                                modId,
                                                            )
                                                        }
                                                        className="px-3 py-1.5 bg-white/10 rounded-lg text-xs font-bold"
                                                    >
                                                        Resume
                                                    </button>
                                                )}

                                                {status !== "downloaded" && (
                                                    <button
                                                        onClick={() =>
                                                            stopDownload(modId)
                                                        }
                                                        className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold"
                                                    >
                                                        Stop
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* FOOTER */}
                    <div className="p-3 border-t border-white/[0.07]">
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
