import { useEffect, useRef, useState } from "react";
import { Header } from "./layout/Header";
import { ModGrid } from "./components/ModGrid";
import { SkeletonGrid } from "./components/SkeletonGrid";
import { InstalledMods } from "./components/InstalledMods";
import { useBrowse } from "./hooks/useBrowse";
import { useSearch } from "./hooks/useSearch";
import { useDownloads } from "./context/DownloadManagerContext";

type Mode = "browse" | "search";
type Tab = "browse" | "installed";

export default function App() {
    const [mode, setMode] = useState<Mode>("browse");
    const [activeTab, setActiveTab] = useState<Tab>("browse");
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const sentinelRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lockRef = useRef(false);

    const browse = useBrowse();
    const search = useSearch();

    const downloadManager = useDownloads();

    useEffect(() => {
        browse.fetchBrowse(1);
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!searchInput.trim()) {
            setMode("browse");
            setSearchQuery("");
            search.resetSearch();
            return;
        }

        debounceRef.current = setTimeout(() => {
            setMode("search");
            setSearchQuery(searchInput);
            search.fetchSearch(searchInput, 1, false);
        }, 400);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [searchInput]);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                if (lockRef.current) return;

                lockRef.current = true;

                if (mode === "browse" && !browse.loading && browse.hasMore) {
                    browse.loadNext();
                }

                if (
                    mode === "search" &&
                    !search.searchFetching &&
                    search.searchHasMore
                ) {
                    search.loadNextSearch(searchQuery);
                }

                setTimeout(() => {
                    lockRef.current = false;
                }, 500);
            },
            { rootMargin: "200px" },
        );

        observer.observe(el);

        return () => observer.disconnect();
    }, [
        mode,
        searchQuery,
        browse.loading,
        browse.hasMore,
        search.searchFetching,
        search.searchHasMore,
    ]);

    const displayMods = mode === "search" ? search.searchMods : browse.mods;

    const isInitialLoading =
        mode === "browse"
            ? browse.loading
            : search.searchFetching && search.searchMods.length === 0;

    const isFetchingMore =
        mode === "browse"
            ? browse.loading && browse.mods.length > 0
            : search.searchFetching && search.searchMods.length > 0;

    return (
        <main className="min-h-screen bg-[#111113] text-white flex flex-col">
            <Header
                mode={mode}
                page={browse.page}
                totalResults={search.totalResults}
                searchInput={searchInput}
                searchFetching={search.searchFetching}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onSearchChange={setSearchInput}
                onSearchClear={() => setSearchInput("")}
                downloadManager={downloadManager}
            />

            <div className="px-6 py-5 flex-1">
                {activeTab === "installed" ? (
                    <InstalledMods />
                ) : isInitialLoading ? (
                    <SkeletonGrid />
                ) : displayMods.length === 0 ? (
                    <div className="text-center py-20 text-gray-600">
                        <div className="text-4xl mb-3">♪</div>
                        <p className="text-sm">
                            {mode === "search"
                                ? `No results for "${searchQuery}"`
                                : "No mods found."}
                        </p>
                    </div>
                ) : (
                    <ModGrid mods={displayMods} />
                )}

                {activeTab === "browse" && (
                    <>
                        <div ref={sentinelRef} className="h-10" />

                        {isFetchingMore && (
                            <div className="flex justify-center py-6">
                                <div className="w-8 h-8 border-2 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
