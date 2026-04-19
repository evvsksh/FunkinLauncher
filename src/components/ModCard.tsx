import { Mod } from "../types/mod";
import { getModImage } from "../utils/format";

interface Props {
    mod: Mod;
    onDownload: (mod: Mod) => void;
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
    const imgSrc = getModImage(mod);

    return (
        <div className="bg-[#0d0a1a] border border-white/[0.07] rounded-xl overflow-hidden cursor-pointer group hover:border-[#ff5cf0]/40 hover:-translate-y-1 transition-all duration-200 flex flex-col">
            <div className="overflow-hidden aspect-video bg-black/40 relative">
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={mod._sName}
                        loading="lazy"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                                "none";
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10 text-2xl">
                        ♪
                    </div>
                )}
                {mod._bWasFeatured && (
                    <span className="absolute top-2 left-2 text-[9px] font-black uppercase tracking-wider bg-[#ff5cf0] text-black px-2 py-0.5 rounded-full">
                        Featured
                    </span>
                )}
            </div>

            <div className="p-3 flex flex-col flex-1">
                <h2 className="text-[13px] font-semibold text-white/90 group-hover:text-[#ff5cf0] transition-colors line-clamp-2 leading-tight mb-1">
                    {mod._sName}
                </h2>
                <p className="text-[11px] text-white/25 mb-2.5">
                    by{" "}
                    <span className="text-white/40 font-medium">
                        {mod._aSubmitter._sName}
                    </span>
                </p>

                {mod._nViewCount || mod._nLikeCount || mod._nPostCount ? (
                    <div className="flex items-center gap-3 mb-2.5">
                        {mod._nViewCount ? (
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
                        ) : null}
                        {mod._nLikeCount ? (
                            <StatPill
                                value={mod._nLikeCount}
                                icon={
                                    <svg
                                        width="11"
                                        height="11"
                                        viewBox="0 0 16 16"
                                        fill="currentColor"
                                        stroke="none"
                                    >
                                        <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5a3 3 0 0 1 5.5-1.65A3 3 0 0 1 14.5 5.5c0 4-6.5 8-6.5 8Z" />
                                    </svg>
                                }
                            />
                        ) : null}
                        {mod._nPostCount ? (
                            <StatPill
                                value={mod._nPostCount}
                                icon={
                                    <svg
                                        width="11"
                                        height="11"
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path
                                            d="M2 2h12v9H9l-3 3v-3H2z"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                }
                            />
                        ) : null}
                    </div>
                ) : null}

                <button
                    onClick={() => onDownload(mod)}
                    className="mt-auto w-full py-1.5 bg-[#ff5cf0] hover:bg-[#ff80f4] active:scale-95 text-black font-black text-[11px] tracking-wide rounded-md transition-all"
                >
                    Download
                </button>
            </div>
        </div>
    );
}
