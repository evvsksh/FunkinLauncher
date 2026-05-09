import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Mod, ModFile } from "../types/mod";
import { getModImage } from "../utils/format";
import { useDownloadManager } from "../hooks/downloadManager";

interface Props {
    mod: Mod;
}

export function ModCard({ mod }: Props) {
    const [files, setFiles] = useState<ModFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<ModFile | null>(null);
    const [showDownloadModal, setShowDownloadModal] = useState(false);

    const { startDownload, getProgress, getStatus } = useDownloadManager();

    const modId = mod._idRow.toString();
    const status = getStatus(modId);
    const progress = getProgress(modId);

    const imgSrc = getModImage(mod);

    useEffect(() => {
        invoke<boolean>("is_mod_downloaded", {
            modId,
        }).then((exists: boolean) => {
            if (exists) {
                setShowDownloadModal(false);
            }
        });

        fetch(`https://gamebanana.com/apiv11/Mod/${mod._idRow}/DownloadPage`)
            .then((r) => r.json())
            .then((data) => {
                const list = data._aFiles ?? [];
                setFiles(list);
                setSelectedFile(list[0] ?? null);
            })
            .catch(() => {});
    }, [mod._idRow]);

    const handlePlay = async () => {
        await invoke("launch_mod", { modId });
    };

    const handleDownload = async () => {
        if (!selectedFile) return;
        await startDownload(mod, selectedFile);
    };

    const formatNumber = (n: number) => {
        if (!n) return "0";
        if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toString();
    };

    const views = formatNumber(mod._nViewCount ?? 0);
    const likes = formatNumber(mod._nLikeCount ?? 0);

    const totalDownloads = files.reduce(
        (acc, file) => acc + (file._nDownloadCount ?? 0),
        0,
    );

    const downloads = formatNumber(totalDownloads);

    return (
        <div className="bg-[#0d0a1a] border border-white/[0.07] rounded-xl overflow-hidden group hover:border-[#ff5cf0]/40 transition-all flex flex-col">
            <div className="overflow-hidden aspect-video bg-black/40 relative">
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={mod._sName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10 text-2xl">
                        ♪
                    </div>
                )}
            </div>

            <div className="p-3 flex flex-col flex-1">
                <h2 className="text-[13px] font-semibold text-white/90 group-hover:text-[#ff5cf0] line-clamp-2">
                    {mod._sName}
                </h2>

                <div className="mb-2 mt-1 flex flex-col gap-1.5">
                    <p className="text-[11px] text-white/25">
                        by {mod._aSubmitter._sName}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/40">
                        <span className="flex items-center gap-1">
                            <svg
                                className="w-3.5 h-3.5 text-white/40"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                            {views}
                        </span>

                        <span className="flex items-center gap-1">
                            <svg
                                className="w-3.5 h-3.5 text-white/40"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M20.8 4.6c-1.5-1.4-3.9-1.4-5.4 0L12 8l-3.4-3.4c-1.5-1.4-3.9-1.4-5.4 0s-1.4 3.9 0 5.4L12 21l8.8-8.9c1.4-1.5 1.4-3.9 0-5.5z" />
                            </svg>
                            {likes}
                        </span>

                        <span className="flex items-center gap-1">
                            <svg
                                className="w-3.5 h-3.5 text-white/40"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            {downloads}
                        </span>
                    </div>
                </div>

                <div className="mt-auto flex gap-2 items-center">
                    {status === "idle" ? (
                        <button
                            onClick={() => setShowDownloadModal(true)}
                            className="flex-1 py-1.5 font-black text-[11px] rounded-md bg-[#ff5cf0] text-black hover:bg-[#ff80f4] transition"
                        >
                            Download
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={
                                    status === "downloaded"
                                        ? handlePlay
                                        : () => setShowDownloadModal(true)
                                }
                                className={`flex-1 py-1.5 font-black text-[11px] rounded-md transition ${
                                    status === "downloaded"
                                        ? "bg-[#5cff94] text-black"
                                        : "bg-[#ff5cf0] text-black hover:bg-[#ff80f4]"
                                }`}
                            >
                                {status === "downloaded"
                                    ? "Play Now"
                                    : `${progress.toFixed(2)}%`}
                            </button>

                            <button
                                onClick={() => setShowDownloadModal(true)}
                                className="w-8 h-8 flex items-center justify-center border border-white/10 rounded-md hover:border-[#ff5cf0]/40 hover:bg-white/5 transition"
                            >
                                +
                            </button>
                        </>
                    )}
                </div>

                {showDownloadModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
                        <div className="bg-[#0d0a1a] p-4 rounded-lg border border-white/10">
                            <button onClick={() => setShowDownloadModal(false)}>
                                Close
                            </button>
                            <button onClick={handleDownload}>
                                Download Selected
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
