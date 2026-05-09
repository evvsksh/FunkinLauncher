import { useState, useCallback } from "react";
import { Mod } from "../types/mod";
import { log } from "../utils/log";

export function useSearch() {
    const [searchMods, setSearchMods] = useState<Mod[]>([]);
    const [searchFetching, setSearchFetching] = useState(false);
    const [searchHasMore, setSearchHasMore] = useState(true);
    const [searchPage, setSearchPage] = useState(1);
    const [totalResults, setTotalResults] = useState<number | null>(null);

    const fetchSearch = useCallback(
        async (query: string, pageNum: number, append = false) => {
            if (!query.trim()) {
                log.warn("Attempted empty search");
                return;
            }

            setSearchFetching(true);

            log.info(
                `Searching "${query}" | page=${pageNum} | append=${append}`,
            );

            try {
                const url = `https://gamebanana.com/apiv11/Util/Search/Results?_sModelName=Mod&_sOrder=popularity&_idGameRow=8694&_sSearchString=${encodeURIComponent(query)}&_csvFields=name%2Cdescription%2Carticle%2Cattribs%2Cstudio%2Cowner%2Ccredits&_nPage=${pageNum}`;

                const res = await fetch(url);

                log.debug(`Response status: ${res.status}`);

                const data = await res.json();
                const records: Mod[] = data?._aRecords ?? [];

                log.success(`Fetched ${records.length} mods for "${query}"`);

                if (pageNum === 1) {
                    const count = data?._aMetadata?._nRecordCount ?? null;

                    setTotalResults(count);

                    log.info(`Total search results: ${count}`);
                }

                setSearchMods((prev) => {
                    const map = new Map<string, Mod>();

                    for (const m of append ? prev : []) {
                        map.set(m._idRow.toString(), m);
                    }

                    for (const m of records) {
                        map.set(m._idRow.toString(), m);
                    }

                    const finalMods = Array.from(map.values());

                    log.debug(`Merged mod list size: ${finalMods.length}`);

                    return finalMods;
                });

                setSearchHasMore(records.length === 15);
                setSearchPage(pageNum);

                log.note(`searchHasMore=${records.length === 15}`);
            } catch (e) {
                log.error("Search request failed", e);
            } finally {
                setSearchFetching(false);

                log.info("Search finished");
            }
        },
        [],
    );

    const loadNextSearch = useCallback(
        (query: string) => {
            const next = searchPage + 1;

            log.info(`Loading next search page: ${next}`);

            fetchSearch(query, next, true);
        },
        [searchPage, fetchSearch],
    );

    const resetSearch = useCallback(() => {
        log.warn("Resetting search state");

        setSearchMods([]);
        setSearchPage(1);
        setSearchHasMore(true);
        setTotalResults(null);
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
