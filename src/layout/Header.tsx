import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import logo from "../assets/logo.svg";
import { DownloadPanel } from "../components/DownloadPanel";
import {
    MinusIcon,
    Square2StackIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

interface Props {
    mode: "browse" | "search";
    page: number;
    totalResults: number | null;
    searchInput: string;
    searchFetching: boolean;
    activeTab: "browse" | "installed";
    onTabChange: (tab: "browse" | "installed") => void;
    onSearchChange: (value: string) => void;
    onSearchClear: () => void;
    downloadManager: any;
}

const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const appWindow = isTauri ? getCurrentWindow() : null;

export function Header({
    searchInput,
    searchFetching,
    activeTab,
    onTabChange,
    onSearchChange,
    onSearchClear,
    downloadManager,
}: Props) {
    const [openDownloads, setOpenDownloads] = useState(false);

    const {
        downloads,
        getProgress,
        getStatus,
        pauseDownload,
        resumeDownload,
        stopDownload,
    } = downloadManager;

    return (
        <header className="sticky top-0 z-40 bg-[#0d0a1a]/95 backdrop-blur border-b border-white/[0.07]">
            <div className="h-15 px-6 flex items-center justify-between">
                <div
                    className="flex items-center gap-2.5 h-full select-none"
                    data-tauri-drag-region
                >
                    <img src={logo} alt="FNF" className="w-7 h-7" />
                    <h1 className="text-lg font-black italic tracking-tight text-white">
                        FUNKIN' <span className="text-[#ff5cf0]">LAUNCHER</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setOpenDownloads(true)}
                        className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-5 h-5 text-white/80"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>

                        {Object.keys(downloads).length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] flex items-center justify-center bg-pink-500 text-black font-black rounded-full">
                                {Object.keys(downloads).length}
                            </span>
                        )}
                    </button>

                    <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-xl p-1">
                        <button
                            onClick={() => onTabChange("browse")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                                activeTab === "browse"
                                    ? "bg-[#ff5cf0] text-black shadow-lg shadow-[#ff5cf0]/20"
                                    : "text-white/40 hover:text-white/70"
                            }`}
                        >
                            Browse
                        </button>

                        <button
                            onClick={() => onTabChange("installed")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                                activeTab === "installed"
                                    ? "bg-[#5cff94] text-black shadow-lg shadow-[#5cff94]/20"
                                    : "text-white/40 hover:text-white/70"
                            }`}
                        >
                            Installed
                        </button>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                        <button
                            onClick={() => appWindow?.minimize().catch(console.error)}
                            className="w-8 h-8 rounded-md text-white/60 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
                        >
                            <MinusIcon className="w-4 h-4" />
                        </button>

                        <button
                            onClick={() => appWindow?.toggleMaximize().catch(console.error)}
                            className="w-8 h-8 rounded-md text-white/60 hover:bg-white/10 hover:text-white transition flex items-center justify-center"
                        >
                            <Square2StackIcon className="w-4 h-4" />
                        </button>

                        <button
                            onClick={() => appWindow?.close().catch(console.error)}
                            className="w-8 h-8 rounded-md text-white/60 hover:bg-red-500/20 hover:text-red-400 transition flex items-center justify-center"
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === "browse" && (
                <div className="px-6 pb-4">
                    <div className="flex items-center gap-2 h-10 px-4 bg-white/5 border border-white/10 rounded-xl focus-within:border-[#ff5cf0]/40 transition-colors">
                        {searchFetching && searchInput ? (
                            <div className="w-3.5 h-3.5 border border-[#ff5cf0]/40 border-t-[#ff5cf0] rounded-full animate-spin shrink-0" />
                        ) : (
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-white/30 shrink-0"
                            >
                                <circle cx="7" cy="7" r="5" />
                                <line x1="10.5" y1="10.5" x2="14" y2="14" />
                            </svg>
                        )}

                        <input
                            type="text"
                            placeholder="Search all FNF mods..."
                            value={searchInput}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm text-gray-100 placeholder-white/20 w-full"
                        />

                        {searchInput && (
                            <button
                                onClick={onSearchClear}
                                className="text-white/20 hover:text-white/60 transition-colors shrink-0"
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>
            )}

            {openDownloads && (
                <DownloadPanel
                    downloads={downloads}
                    getProgress={getProgress}
                    getStatus={getStatus}
                    pauseDownload={pauseDownload}
                    resumeDownload={resumeDownload}
                    stopDownload={stopDownload}
                    onClose={() => setOpenDownloads(false)}
                />
            )}
        </header>
    );
}