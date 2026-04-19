import { useState, useCallback, useRef } from "react";
import { Mod } from "../types/mod";

export function useBrowse() {
    const [mods, setMods] = useState<Mod[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);

    const isFetchingRef = useRef(false);

    const fetchBrowse = useCallback(
        async (pageNum: number) => {
            if (isFetchingRef.current || !hasMore) return;

            isFetchingRef.current = true;

            if (pageNum === 1) setLoading(true);

            try {
                const res = await fetch(
                    `https://gamebanana.com/apiv11/Mod/Index?_nPerpage=15&_sSort=Generic_MostDownloaded&_aFilters[Generic_Game]=8694&_nPage=${pageNum}`,
                );

                const data = await res.json();

                const records = data?._aRecords ?? [];

                if (records.length > 0) {
                    setMods((prev) =>
                        pageNum === 1 ? records : [...prev, ...records],
                    );

                    if (records.length < 15) {
                        setHasMore(false);
                    }
                } else {
                    setHasMore(false);
                }
            } catch (e) {
                console.error("Browse fetch failed:", e);
            } finally {
                isFetchingRef.current = false;
                setLoading(false);
            }
        },
        [hasMore],
    );

    const loadNext = useCallback(() => {
        setPage((prev) => {
            const next = prev + 1;
            fetchBrowse(next);
            return next;
        });
    }, [fetchBrowse]);

    return { mods, loading, hasMore, page, fetchBrowse, loadNext };
}
