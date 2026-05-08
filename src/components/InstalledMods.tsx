import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";

interface InstalledMod {
    id: string;
    name: string;
}

export function InstalledMods() {
    const [mods, setMods] = useState<InstalledMod[]>([]);
    const [loading, setLoading] = useState(true);

    const loadInstalled = async () => {
        try {
            const dataDir = await appDataDir();
            const modsDir = await join(dataDir, "mods");
            const entries = await readDir(modsDir);
            const installed: InstalledMod[] = entries
                .filter((e) => e.isDirectory)
                .map((e) => ({ id: e.name, name: e.name }));
            setMods(installed);
        } catch {
            setMods([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInstalled();
    }, []);

    const handlePlay = async (modId: string) => {
        await invoke("launch_mod", { modId });
    };

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
                            <div className="h-2.5 bg-white/10 rounded" />
                            <div className="h-7 bg-[#5cff94]/30 rounded-md mt-2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (mods.length === 0) {
        return (
            <div className="text-center py-20 text-gray-600">
                <div className="text-4xl mb-3">♪</div>
                <p className="text-sm">No installed mods found.</p>
                <p className="text-xs mt-1 text-gray-700">
                    Download mods from the Browse tab.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-3.5">
            {mods.map((mod) => (
                <div
                    key={mod.id}
                    className="bg-[#0d0a1a] border border-white/[0.07] rounded-xl overflow-hidden group hover:border-[#5cff94]/40 transition-all flex flex-col"
                >
                    <div className="overflow-hidden aspect-video bg-black/40 relative flex items-center justify-center">
                        <span className="text-4xl text-white/10">♪</span>
                    </div>

                    <div className="p-3 flex flex-col flex-1">
                        <h2 className="text-[13px] font-semibold text-white/90 group-hover:text-[#5cff94] line-clamp-2">
                            {mod.name}
                        </h2>

                        <p className="text-[11px] text-white/25 mb-2">
                            Installed
                        </p>

                        <div className="mt-auto flex gap-2">
                            <button
                                onClick={() => handlePlay(mod.id)}
                                className="flex-1 py-1.5 font-black text-[11px] rounded-md bg-[#5cff94] text-black hover:brightness-110 transition"
                            >
                                Play Now
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
