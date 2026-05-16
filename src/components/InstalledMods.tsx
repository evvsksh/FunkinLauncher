import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { log } from "../utils/log";
import { Mod } from "../types/mod";
import { EyeIcon, HeartIcon } from "@heroicons/react/24/outline";

interface InstalledMod {
    id: string;
    mod: Mod | null;
}

function formatNumber(n: number) {
    if (!n) return "0";
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
}

function getThumbLow(mod: Mod | null) {
    const img = mod?._aPreviewMedia?._aImages?.[0];
    if (!img) return null;

    const base = img._sBaseUrl;

    return (
        (img._sFile100 && `${base}/${img._sFile100}`) ||
        (img._sFile220 && `${base}/${img._sFile220}`) ||
        null
    );
}

function getThumbHigh(mod: Mod | null) {
    const img = mod?._aPreviewMedia?._aImages?.[0];
    if (!img) return null;

    return img._sFile800
        ? `${img._sBaseUrl}/${img._sFile800}`
        : img._sFile530
        ? `${img._sBaseUrl}/${img._sFile530}`
        : null;
}

function InstalledModCard({ id, mod }: { id: string; mod: Mod | null }) {
    const [img, setImg] = useState<string | null>(getThumbLow(mod));

    useEffect(() => {
        let cancelled = false;

        const high = getThumbHigh(mod);
        if (!high) return;

        const preload = new Image();
        preload.src = high;

        preload.onload = () => {
            if (!cancelled) setImg(high);
        };

        return () => {
            cancelled = true;
        };
    }, [mod]);

    const views = formatNumber(mod?._nViewCount ?? 0);
    const likes = formatNumber(mod?._nLikeCount ?? 0);
    const author = mod?._aSubmitter?._sName ?? "Unknown";

    const handlePlay = async () => {
        await invoke("launch_mod", { modId: id });
    };

    return (
        <div className="bg-[#0d0a1a] border border-white/[0.07] rounded-xl overflow-hidden group hover:border-[#5cff94]/40 transition-all flex flex-col">
            <div className="aspect-video bg-black/40 overflow-hidden">
                {img ? (
                    <img
                        src={img}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        draggable={false}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10 text-3xl">
                        ♪
                    </div>
                )}
            </div>

            <div className="p-3 flex flex-col flex-1">
                <div className="text-[13px] font-semibold text-white/90 group-hover:text-[#5cff94] line-clamp-2">
                    {mod?._sName || id}
                </div>

                <div className="text-[11px] text-white/30 mt-1">
                    by {author}
                </div>

                <div className="flex items-center gap-3 text-[10px] text-white/40 mt-2">
                    <span className="flex items-center gap-1">
                        <EyeIcon className="w-3.5 h-3.5" />
                        {views}
                    </span>

                    <span className="flex items-center gap-1">
                        <HeartIcon className="w-3.5 h-3.5" />
                        {likes}
                    </span>
                </div>

                <div className="mt-auto pt-3">
                    <button
                        onClick={handlePlay}
                        className="w-full py-1.5 text-[11px] font-black rounded-md bg-[#5cff94] text-black hover:brightness-110 transition"
                    >
                        Play Now
                    </button>
                </div>
            </div>
        </div>
    );
}

export function InstalledMods() {
    const [mods, setMods] = useState<InstalledMod[]>([]);
    const [loading, setLoading] = useState(true);

    const loadInstalled = async () => {
        try {
            const dataDir = await appDataDir();
            const modsDir = await join(dataDir, "mods");

            const entries = await readDir(modsDir);

            const ids = entries
                .filter((e: any) => e.isDirectory && e.name)
                .map((e: any) => e.name);

            const results = await Promise.all(
                ids.map(async (id) => {
                    try {
                        const res = await fetch(
                            `https://gamebanana.com/apiv12/Mod/${id}/ProfilePage`
                        );

                        const data = await res.json();

                        const mod: Mod = {
                            _idRow: data._idRow,
                            _sName: data._sName,
                            _nViewCount: data._nViewCount,
                            _nLikeCount: data._nLikeCount,
                            _aSubmitter: data._aSubmitter,
                            _aPreviewMedia: data._aPreviewMedia,
                        } as any;

                        return { id, mod };
                    } catch {
                        return { id, mod: null };
                    }
                })
            );

            setMods(results);
        } catch (e) {
            log.error("Failed reading mods folder", e);
            setMods([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInstalled();
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-3 gap-3.5">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="bg-[#1c1c1f] border border-white/[0.07] rounded-xl overflow-hidden animate-pulse"
                    >
                        <div className="aspect-video bg-white/5" />
                        <div className="p-3 space-y-2">
                            <div className="h-3 bg-white/10 rounded w-2/3" />
                            <div className="h-7 bg-[#5cff94]/20 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!mods.length) {
        return (
            <div className="text-center py-20 text-gray-600">
                <div className="text-4xl mb-3">♪</div>
                <div className="text-sm">No installed mods found.</div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-3.5">
            {mods.map((m) => (
                <InstalledModCard key={m.id} id={m.id} mod={m.mod} />
            ))}
        </div>
    );
}