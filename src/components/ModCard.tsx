import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Mod } from "../types/mod";
import { getModImage } from "../utils/format";
import { useDownloads } from "../context/DownloadManagerContext";
import { DownloadModal } from "./DownloadModal";
import {
    EyeIcon,
    HeartIcon,
    ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

interface Props {
    mod: Mod;
}

export function ModCard({ mod }: Props) {
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [downloadsCount, setDownloadsCount] = useState(0);

    const { downloads } = useDownloads();

    const modId = mod._idRow.toString();

    const activeDownloads = useMemo(() => {
        return Object.values(downloads).filter((d) => d.modId === modId);
    }, [downloads, modId]);

    const mainDownload = activeDownloads[0];

    const status = mainDownload?.status ?? "idle";
    const progress = mainDownload?.progress ?? 0;

    const imgSrc = getModImage(mod);

    useEffect(() => {
        invoke<boolean>("is_mod_downloaded", { modId }).then((exists) => {
            if (exists) setShowDownloadModal(false);
        });
    }, [modId]);

    useEffect(() => {
        let cancelled = false;

        fetch(`https://gamebanana.com/apiv11/Mod/${mod._idRow}/DownloadPage`)
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;

                const total = (data._aFiles ?? []).length;

                setDownloadsCount(total);
            })
            .catch(() => {
                if (!cancelled) setDownloadsCount(0);
            });

        return () => {
            cancelled = true;
        };
    }, [mod._idRow]);

    const handlePlay = async () => {
        await invoke("launch_mod", { modId });
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
    const downloadsFmt = formatNumber(downloadsCount);

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
                            <EyeIcon className="w-3.5 h-3.5 text-white/40" />
                            {views}
                        </span>

                        <span className="flex items-center gap-1">
                            <HeartIcon className="w-3.5 h-3.5 text-white/40" />
                            {likes}
                        </span>

                        <span className="flex items-center gap-1">
                            <ArrowDownTrayIcon className="w-3.5 h-3.5 text-white/40" />
                            {downloadsFmt}
                        </span>
                    </div>
                </div>

                <div className="mt-auto flex gap-2 items-center">
                    {status === "downloaded" ? (
                        <button
                            onClick={handlePlay}
                            className="flex-1 py-1.5 font-black text-[11px] rounded-md bg-[#5cff94] text-black"
                        >
                            Play Now
                        </button>
                    ) : status === "downloading" || status === "paused" ? (
                        <button
                            onClick={() => setShowDownloadModal(true)}
                            className="flex-1 py-1.5 font-black text-[11px] rounded-md bg-[#ff5cf0] text-black hover:bg-[#ff80f4]"
                        >
                            {`${progress.toFixed(2)}%`}
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowDownloadModal(true)}
                            className="flex-1 py-1.5 font-black text-[11px] rounded-md bg-[#ff5cf0] text-black hover:bg-[#ff80f4]"
                        >
                            Download
                        </button>
                    )}

                    {status === "downloaded" && (
                        <button
                            onClick={() => setShowDownloadModal(true)}
                            className="w-8 h-8 flex items-center justify-center border border-white/10 rounded-md hover:border-[#ff5cf0]/40"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4 text-white/70" />
                        </button>
                    )}
                </div>

                {showDownloadModal && (
                    <DownloadModal
                        mod={mod}
                        onClose={() => setShowDownloadModal(false)}
                    />
                )}
            </div>
        </div>
    );
}
