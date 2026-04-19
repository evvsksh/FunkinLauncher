import { useEffect, useRef, useState } from "react";
import { Header } from "./layout/Header";
import { ModGrid } from "./components/ModGrid";
import { SkeletonGrid } from "./components/SkeletonGrid";
import { DownloadModal } from "./components/DownloadModal";
import { useBrowse } from "./hooks/useBrowse";
import { useSearch } from "./hooks/useSearch";
import { Mod } from "./types/mod";

type Mode = "browse" | "search";

export default function App() {
    const [mode, setMode] = useState<Mode>("browse");
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMod, setSelectedMod] = useState<Mod | null>(null);

    const sentinelRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const browse = useBrowse();
    const search = useSearch();

    // initial load (safe)
    useEffect(() => {
        browse.fetchBrowse(1);
    }, []);

    // search debounce
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

    // stable values (IMPORTANT FIX)
    const isBrowseFetching = browse.isFetching;
    const hasBrowseMore = browse.hasMore;

    const isSearchFetching = search.searchFetching;
    const hasSearchMore = search.searchHasMore;

    // intersection observer (FIXED)
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;

                if (mode === "browse") {
                    if (!isBrowseFetching && hasBrowseMore) {
                        browse.loadNext();
                    }
                }

                if (mode === "search") {
                    if (!isSearchFetching && hasSearchMore) {
                        search.loadNextSearch(searchQuery);
                    }
                }
            },
            { rootMargin: "200px" },
        );

        observer.observe(el);

        return () => observer.disconnect();
    }, [
        mode,
        isBrowseFetching,
        hasBrowseMore,
        isSearchFetching,
        hasSearchMore,
        searchQuery,
    ]);

    const displayMods = mode === "search" ? search.searchMods : browse.mods;

    const isInitialLoading =
        mode === "browse"
            ? browse.loading
            : search.searchFetching && search.searchMods.length === 0;

    const isFetchingMore =
        mode === "browse"
            ? browse.isFetching && !browse.loading
            : search.searchFetching && search.searchMods.length > 0;

    return (
        <main className="min-h-screen bg-[#111113] text-white flex flex-col">
            <Header
                mode={mode}
                page={browse.page}
                totalResults={search.totalResults}
                searchInput={searchInput}
                searchFetching={search.searchFetching}
                onSearchChange={setSearchInput}
                onSearchClear={() => setSearchInput("")}
            />

            <div className="px-6 py-5 flex-1">
                {isInitialLoading ? (
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
                    <ModGrid mods={displayMods} onDownload={setSelectedMod} />
                )}

                <div ref={sentinelRef} className="h-10" />

                {isFetchingMore && (
                    <div className="flex justify-center py-6">
                        <div className="w-8 h-8 border-2 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
                    </div>
                )}

                {mode === "browse" &&
                    !browse.hasMore &&
                    browse.mods.length > 0 && (
                        <p className="text-center text-xs text-gray-700 py-6">
                            All mods loaded
                        </p>
                    )}
            </div>

            {selectedMod && (
                <DownloadModal
                    mod={selectedMod}
                    onClose={() => setSelectedMod(null)}
                />
            )}
        </main>
    );
}
