import { useState, useCallback, useRef } from "react";
import { Mod } from "../types/mod";
import { log } from "../utils/log";

const PER_PAGE = 15;

export function useBrowse() {
    const [mods, setMods] = useState<Mod[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);

    const isFetchingRef = useRef(false);

    const fetchBrowse = useCallback(async (pageNum: number, reset = false) => {
        if (isFetchingRef.current) {
            log.warn(
                `Skipped browse fetch for page ${pageNum} because request is already running`,
            );
            return;
        }

        isFetchingRef.current = true;

        if (reset) {
            log.info(`Resetting browse state`);
            setLoading(true);
            setHasMore(true);
        }

        try {
            log.pending(`Fetching browse page ${pageNum}`);

            const url = `https://gamebanana.com/apiv11/Mod/Index?_nPerpage=${PER_PAGE}&_sSort=Generic_MostDownloaded&_aFilters[Generic_Game]=8694&_nPage=${pageNum}`;

            log.await(`GET ${url}`);

            const res = await fetch(url);

            log.info(`Browse response status: ${res.status}`);

            const data = await res.json();
            const records: Mod[] = data?._aRecords ?? [];

            log.success(
                `Fetched ${records.length} mods from browse page ${pageNum}`,
            );

            setMods((prev) => {
                const map = new Map<string, Mod>();

                for (const m of reset ? [] : prev) {
                    map.set(m._idRow.toString(), m);
                }

                for (const m of records) {
                    map.set(m._idRow.toString(), m);
                }

                const merged = Array.from(map.values());

                log.info(`Current browse cache size: ${merged.length}`);

                return merged;
            });

            setPage(pageNum);

            if (records.length < PER_PAGE) {
                log.warn(`No more browse pages available`);
                setHasMore(false);
            }
        } catch (e) {
            log.error(`Browse fetch failed`);
            log.error(e);
        } finally {
            isFetchingRef.current = false;
            setLoading(false);

            log.complete(`Finished browse fetch for page ${pageNum}`);
        }
    }, []);

    const loadNext = useCallback(() => {
        if (isFetchingRef.current) {
            log.warn(`Skipped loadNext because fetch is active`);
            return;
        }

        if (!hasMore) {
            log.warn(`Skipped loadNext because hasMore=false`);
            return;
        }

        const nextPage = page + 1;

        log.info(`Loading next browse page: ${nextPage}`);

        fetchBrowse(nextPage);
    }, [page, hasMore, fetchBrowse]);

    const resetBrowse = useCallback(() => {
        log.info(`Resetting browse hook`);

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
