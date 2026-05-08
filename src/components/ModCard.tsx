import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Mod, ModFile } from "../types/mod";
import { getModImage } from "../utils/format";
import { DownloadModal } from "./DownloadModal";
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
        }).then((exists) => {
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

    return (
        <>
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

                    <p className="text-[11px] text-white/25 mb-2">
                        by {mod._aSubmitter._sName}
                    </p>

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
                </div>
            </div>

            {showDownloadModal && (
                <DownloadModal
                    mod={mod}
                    onClose={() => setShowDownloadModal(false)}
                />
            )}
        </>
    );
}
