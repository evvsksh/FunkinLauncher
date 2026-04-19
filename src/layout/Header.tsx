import logo from "../assets/logo.svg";

type Mode = "browse" | "search";

interface Props {
    mode: Mode;
    page: number;
    totalResults: number | null;
    searchInput: string;
    searchFetching: boolean;
    onSearchChange: (value: string) => void;
    onSearchClear: () => void;
}

export function Header({
    mode,
    page,
    totalResults,
    searchInput,
    searchFetching,
    onSearchChange,
    onSearchClear,
}: Props) {
    return (
        <header className="sticky top-0 z-40 bg-[#0d0a1a]/95 backdrop-blur border-b border-white/[0.07]">
            <div className="h-15 px-6 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <img src={logo} alt="FNF" className="w-7 h-7" />
                    <h1 className="text-lg font-black italic tracking-tight text-white">
                        FUNKIN' <span className="text-[#ff5cf0]">LAUNCHER</span>
                    </h1>
                </div>

                <div className="text-[11px] font-medium text-white/30 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                    {mode === "search" && totalResults !== null ? (
                        <>
                            <span className="text-[#ff5cf0]">
                                {totalResults.toLocaleString()}
                            </span>{" "}
                            results
                        </>
                    ) : (
                        <>
                            Page <span className="text-[#ff5cf0]">{page}</span>
                        </>
                    )}
                </div>
            </div>

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
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                            >
                                <line x1="2" y1="2" x2="14" y2="14" />
                                <line x1="14" y1="2" x2="2" y2="14" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
