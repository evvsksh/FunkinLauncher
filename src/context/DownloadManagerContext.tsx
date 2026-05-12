import { createContext, useContext, ReactNode } from "react";
import { useDownloadManager } from "../hooks/downloadManager";

const DownloadManagerContext = createContext<
    ReturnType<typeof useDownloadManager> | undefined
>(undefined);

export function DownloadManagerProvider({ children }: { children: ReactNode }) {
    const manager = useDownloadManager();

    return (
        <DownloadManagerContext.Provider value={manager}>
            {children}
        </DownloadManagerContext.Provider>
    );
}

export function useDownloads() {
    const ctx = useContext(DownloadManagerContext);

    if (!ctx) {
        throw new Error(
            "useDownloads must be used inside DownloadManagerProvider",
        );
    }

    return ctx;
}
