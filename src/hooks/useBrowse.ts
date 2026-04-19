import { useState, useCallback } from "react";
import { Mod } from "../types/mod";

export function useBrowse() {
    const [mods, setMods] = useState<Mod[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);

    const fetchBrowse = useCallback(
        async (pageNum: number) => {
            if (isFetching || !hasMore) return;
            setIsFetching(true);
            if (pageNum === 1) setLoading(true);
            try {
                const res = await fetch(
                    `https://gamebanana.com/apiv11/Mod/Index?_nPerpage=15&_sSort=Generic_MostDownloaded&_aFilters[Generic_Game]=8694&_nPage=${pageNum}`,
                );
                const data = await res.json();
                if (data._aRecords?.length) {
                    setMods((prev) =>
                        pageNum === 1
                            ? data._aRecords
                            : [...prev, ...data._aRecords],
                    );
                    if (data._aRecords.length < 15) setHasMore(false);
                } else {
                    setHasMore(false);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsFetching(false);
                setLoading(false);
            }
        },
        [isFetching, hasMore],
    );

    const loadNext = useCallback(() => {
        const next = page + 1;
        setPage(next);
        fetchBrowse(next);
    }, [page, fetchBrowse]);

    return { mods, loading, isFetching, hasMore, page, fetchBrowse, loadNext };
}
