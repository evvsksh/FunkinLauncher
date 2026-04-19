import { useState, useCallback, useRef } from "react";
import { Mod } from "../types/mod";

const PER_PAGE = 15;

export function useBrowse() {
    const [mods, setMods] = useState<Mod[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);

    const isFetchingRef = useRef(false);

    const fetchBrowse = useCallback(async (pageNum: number, reset = false) => {
        if (isFetchingRef.current) return;

        isFetchingRef.current = true;

        if (reset) {
            setLoading(true);
            setHasMore(true);
        }

        try {
            const res = await fetch(
                `https://gamebanana.com/apiv11/Mod/Index?_nPerpage=${PER_PAGE}&_sSort=Generic_MostDownloaded&_aFilters[Generic_Game]=8694&_nPage=${pageNum}`,
            );

            const data = await res.json();
            const records: Mod[] = data?._aRecords ?? [];

            setMods((prev) => {
                const map = new Map<string, Mod>();
                for (const m of reset ? [] : prev) {
                    map.set(m._idRow.toString(), m);
                }
                for (const m of records) {
                    map.set(m._idRow.toString(), m);
                }
                return Array.from(map.values());
            });

            setPage(pageNum);

            if (records.length < PER_PAGE) {
                setHasMore(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
        }
    }, []);

    const loadNext = useCallback(() => {
        if (isFetchingRef.current || !hasMore) return;
        fetchBrowse(page + 1);
    }, [page, hasMore, fetchBrowse]);

    const resetBrowse = useCallback(() => {
        setMods([]);
        setPage(1);
        setHasMore(true);
        fetchBrowse(1, true);
    }, [fetchBrowse]);

    return {
        mods,
        loading,
        hasMore,
        page,
        fetchBrowse,
        loadNext,
        resetBrowse,
    };
}
