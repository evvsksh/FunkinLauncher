import { useState, useCallback } from "react";
import { Mod } from "../types/mod";

export function useSearch() {
    const [searchMods, setSearchMods] = useState<Mod[]>([]);
    const [searchFetching, setSearchFetching] = useState(false);
    const [searchHasMore, setSearchHasMore] = useState(true);
    const [searchPage, setSearchPage] = useState(1);
    const [totalResults, setTotalResults] = useState<number | null>(null);

    const fetchSearch = useCallback(
        async (query: string, pageNum: number, append = false) => {
            if (!query.trim()) return;
            setSearchFetching(true);
            try {
                const url = `https://gamebanana.com/apiv11/Util/Search/Results?_sModelName=Mod&_sOrder=popularity&_idGameRow=8694&_sSearchString=${encodeURIComponent(query)}&_csvFields=name%2Cdescription%2Carticle%2Cattribs%2Cstudio%2Cowner%2Ccredits&_nPage=${pageNum}`;
                const res = await fetch(url);
                const data = await res.json();
                const records: Mod[] = data._aRecords ?? [];
                if (pageNum === 1)
                    setTotalResults(data._aMetadata?._nRecordCount ?? null);
                setSearchMods((prev) =>
                    append ? [...prev, ...records] : records,
                );
                setSearchHasMore(records.length >= 15);
            } catch (e) {
                console.error(e);
            } finally {
                setSearchFetching(false);
            }
        },
        [],
    );

    const loadNextSearch = useCallback(
        (query: string) => {
            const next = searchPage + 1;
            setSearchPage(next);
            fetchSearch(query, next, true);
        },
        [searchPage, fetchSearch],
    );

    const resetSearch = useCallback(() => {
        setSearchMods([]);
        setTotalResults(null);
        setSearchPage(1);
        setSearchHasMore(true);
    }, []);

    return {
        searchMods,
        searchFetching,
        searchHasMore,
        searchPage,
        totalResults,
        fetchSearch,
        loadNextSearch,
        resetSearch,
    };
}
