import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mod, ModFile } from "../types/mod";
import { getModImage } from "../utils/format";

interface Props {
    mod: Mod;
    onDownload: (mod: Mod, file?: ModFile) => void;
}

function StatPill({ icon, value }: { icon: React.ReactNode; value: number }) {
    return (
        <span className="flex items-center gap-1 text-[10px] text-white/30">
            {icon}
            <span>
                {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
            </span>
        </span>
    );
}

export function ModCard({ mod, onDownload }: Props) {
    const [status, setStatus] = useState<"idle" | "downloading" | "downloaded">(
        "idle",
    );
    const [progress, setProgress] = useState(0);
    const [files, setFiles] = useState<ModFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<ModFile | null>(null);
    const [showVersions, setShowVersions] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);

    const imgSrc = getModImage(mod);

    useEffect(() => {
        invoke<boolean>("is_mod_downloaded", {
            modId: mod._idRow.toString(),
        }).then((exists) => {
            if (exists) setStatus("downloaded");
        });

        fetch(`https://gamebanana.com/apiv11/Mod/${mod._idRow}/DownloadPage`)
            .then((r) => r.json())
            .then((data) => {
                const list = data._aFiles ?? [];
                setFiles(list);
                setSelectedFile(list[0] ?? null);
            })
            .catch(() => {});

        const unlisten = listen<[string, number]>(
            "download-progress",
            (event) => {
                const [id, percent] = event.payload;
                if (id.toString() === mod._idRow.toString()) {
                    setProgress(percent as number);
                    if (Number(percent) >= 100) setStatus("downloaded");
                }
            },
        );

        return () => {
            unlisten.then((f) => f());
        };
    }, [mod._idRow]);

    const handlePlay = async () => {
        await invoke("launch_mod", {
            modId: mod._idRow.toString(),
        });
    };

    const handleDownload = async (file?: ModFile) => {
        const f = file ?? selectedFile;
        if (!f) return;
        setStatus("downloading");
        onDownload(mod, f);
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

                    <div className="flex gap-3 mb-2">
                        {mod._nViewCount && (
                            <StatPill
                                value={mod._nViewCount}
                                icon={
                                    <svg
                                        width="11"
                                        height="11"
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <ellipse
                                            cx="8"
                                            cy="8"
                                            rx="7"
                                            ry="4.5"
                                        />
                                        <circle
                                            cx="8"
                                            cy="8"
                                            r="2"
                                            fill="currentColor"
                                            stroke="none"
                                        />
                                    </svg>
                                }
                            />
                        )}

                        {mod._nLikeCount && (
                            <StatPill
                                value={mod._nLikeCount}
                                icon={
                                    <svg
                                        width="11"
                                        height="11"
                                        viewBox="0 0 16 16"
                                        fill="currentColor"
                                    >
                                        <path d="M8 14s6-3.5 6-8a3.5 3.5 0 0 0-6-2 3.5 3.5 0 0 0-6 2c0 4.5 6 8 6 8z" />
                                    </svg>
                                }
                            />
                        )}
                    </div>

                    {showVersions && (
                        <div className="mb-2 bg-white/5 border border-white/10 rounded-lg p-2 max-h-24 overflow-y-auto">
                            {files.map((f) => (
                                <button
                                    key={f._idRow}
                                    onClick={() => {
                                        setSelectedFile(f);
                                        setShowVersions(false);
                                    }}
                                    className="block w-full text-left text-[11px] px-2 py-1 rounded hover:bg-white/10 text-white/70"
                                >
                                    {f._sVersion || f._sFile}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mt-auto flex gap-2 items-center">
                        <button
                            onClick={
                                status === "downloaded"
                                    ? handlePlay
                                    : () => handleDownload()
                            }
                            className={`flex-1 py-1.5 font-black text-[11px] rounded-md transition ${
                                status === "downloaded"
                                    ? "bg-[#5cff94] text-black"
                                    : status === "downloading"
                                      ? "bg-[#ff5cf0] text-black"
                                      : "bg-[#ff5cf0] hover:bg-[#ff80f4] text-black"
                            }`}
                        >
                            {status === "downloaded"
                                ? "Play Now"
                                : status === "downloading"
                                  ? `${progress}%`
                                  : "Download"}
                        </button>

                        <button
                            onClick={() => setShowDownloadModal(true)}
                            className="w-8 h-8 flex items-center justify-center border border-white/10 rounded-md hover:border-[#ff5cf0]/40 hover:bg-white/5 transition"
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-white/60"
                            >
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {showDownloadModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-[#0d0a1a] border border-white/10 rounded-xl p-4 w-[320px]">
                        <h3 className="text-white text-sm font-semibold mb-3">
                            Download Options
                        </h3>

                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {files.map((f) => (
                                <button
                                    key={f._idRow}
                                    onClick={() => {
                                        setSelectedFile(f);
                                        setShowDownloadModal(false);
                                        setStatus("downloading");
                                        onDownload(mod, f);
                                    }}
                                    className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-white/10 text-white/70"
                                >
                                    {f._sVersion || f._sFile}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowDownloadModal(false)}
                            className="mt-3 w-full text-[11px] py-1 rounded bg-white/10 hover:bg-white/20 text-white"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
