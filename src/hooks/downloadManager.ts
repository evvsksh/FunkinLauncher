import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mod, ModFile } from "../types/mod";
import { log } from "../utils/log";

type DownloadStatus =
    | "idle"
    | "downloading"
    | "paused"
    | "downloaded"
    | "error";

interface ActiveDownload {
    downloadId: string;
    modId: string;
    file?: ModFile;
    url?: string;
    progress: number;
    status: DownloadStatus;
}

export function useDownloadManager() {
    const [downloads, setDownloads] = useState<Record<string, ActiveDownload>>(
        {},
    );

    const listenersRef = useRef<null | (() => void)[]>(null);

    useEffect(() => {
        const setup = async () => {
            const unlistenProgress = await listen<[string, number]>(
                "download-progress",
                (event) => {
                    const [downloadId, percent] = event.payload;

                    setDownloads((prev) => {
                        const existing = prev[downloadId];
                        if (!existing) return prev;

                        log.info(
                            `[${existing.modId}] Download: ${percent.toFixed(2)}%`,
                        );

                        return {
                            ...prev,
                            [downloadId]: {
                                ...existing,
                                progress: percent,
                                status:
                                    percent >= 100
                                        ? "downloaded"
                                        : "downloading",
                            },
                        };
                    });
                },
            );

            const unlistenComplete = await listen<string>(
                "download-complete",
                (event) => {
                    const downloadId = event.payload;

                    setDownloads((prev) => {
                        const existing = prev[downloadId];
                        if (!existing) return prev;

                        log.success(`[${existing.modId}] Download complete`);

                        return {
                            ...prev,
                            [downloadId]: {
                                ...existing,
                                progress: 100,
                                status: "downloaded",
                            },
                        };
                    });
                },
            );

            const unlistenFailed = await listen<string>(
                "download-failed",
                (event) => {
                    const downloadId = event.payload;

                    setDownloads((prev) => {
                        const existing = prev[downloadId];
                        if (!existing) return prev;

                        log.error(`[${existing.modId}] Download failed`);

                        return {
                            ...prev,
                            [downloadId]: {
                                ...existing,
                                status: "error",
                            },
                        };
                    });
                },
            );

            listenersRef.current = [
                unlistenProgress,
                unlistenComplete,
                unlistenFailed,
            ];

            log.success("Download listeners initialized");
        };

        setup();

        return () => {
            listenersRef.current?.forEach((u) => u());
            log.warn("Download listeners cleaned up");
        };
    }, []);

    const startDownload = useCallback(async (mod: Mod, file: ModFile) => {
        const downloadId = `${mod._idRow}-${file._idRow ?? file._sDownloadUrl}`;
        const modId = mod._idRow.toString();

        log.pending(`[${modId}] Starting download → ${downloadId}`);

        setDownloads((prev) => ({
            ...prev,
            [downloadId]: {
                downloadId,
                modId,
                file,
                url: file._sDownloadUrl,
                progress: 0,
                status: "downloading",
            },
        }));

        await invoke("download_mod", {
            downloadId,
            modId,
            url: file._sDownloadUrl,
        });

        log.await(`[${modId}] Download request sent`);
    }, []);

    const pauseDownload = useCallback(async (downloadId: string) => {
        log.warn(`[${downloadId}] Pausing download`);
        await invoke("pause_download", { downloadId });
    }, []);

    const resumeDownload = useCallback(async (downloadId: string) => {
        log.pending(`[${downloadId}] Resuming download`);
        await invoke("resume_download", { downloadId });
    }, []);

    const stopDownload = useCallback(async (downloadId: string) => {
        log.error(`[${downloadId}] Stopping download`);

        await invoke("stop_download", { downloadId });

        setDownloads((prev) => {
            const copy = { ...prev };
            delete copy[downloadId];
            return copy;
        });
    }, []);

    return {
        downloads,
        startDownload,
        pauseDownload,
        resumeDownload,
        stopDownload,
    };
}
