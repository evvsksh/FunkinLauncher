import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mod, ModFile } from "../types/mod";

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

                        return {
                            ...prev,
                            [downloadId]: {
                                ...existing,
                                progress: Number(percent),
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

                        return {
                            ...prev,
                            [downloadId]: {
                                ...existing,
                                status: "downloaded",
                                progress: 100,
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
        };

        setup();

        return () => {
            listenersRef.current?.forEach((u) => u());
        };
    }, []);

    const startDownload = useCallback(async (mod: Mod, file: ModFile) => {
        const downloadId = `${mod._idRow}-${file._idRow ?? file._sDownloadUrl}`;

        setDownloads((prev) => ({
            ...prev,
            [downloadId]: {
                downloadId,
                modId: mod._idRow.toString(),
                file,
                url: file._sDownloadUrl,
                progress: 0,
                status: "downloading",
            },
        }));

        await invoke("download_mod", {
            downloadId,
            modId: mod._idRow.toString(),
            url: file._sDownloadUrl,
        });
    }, []);

    const pauseDownload = useCallback(async (downloadId: string) => {
        await invoke("pause_download", { downloadId });

        setDownloads((prev) => {
            const existing = prev[downloadId];
            if (!existing) return prev;

            return {
                ...prev,
                [downloadId]: {
                    ...existing,
                    status: "paused",
                },
            };
        });
    }, []);

    const resumeDownload = useCallback(async (downloadId: string) => {
        await invoke("resume_download", { downloadId });

        setDownloads((prev) => {
            const existing = prev[downloadId];
            if (!existing) return prev;

            return {
                ...prev,
                [downloadId]: {
                    ...existing,
                    status: "downloading",
                },
            };
        });
    }, []);

    const stopDownload = useCallback(async (downloadId: string) => {
        await invoke("stop_download", { downloadId });

        setDownloads((prev) => {
            const copy = { ...prev };
            delete copy[downloadId];
            return copy;
        });
    }, []);

    const getDownload = useCallback(
        (downloadId: string) => downloads[downloadId],
        [downloads],
    );

    const isDownloading = useCallback(
        (downloadId: string) =>
            downloads[downloadId]?.status === "downloading" ||
            downloads[downloadId]?.status === "paused",
        [downloads],
    );

    const getProgress = useCallback(
        (downloadId: string) => downloads[downloadId]?.progress ?? 0,
        [downloads],
    );

    const getStatus = useCallback(
        (downloadId: string) => downloads[downloadId]?.status ?? "idle",
        [downloads],
    );

    return {
        downloads,

        startDownload,
        pauseDownload,
        resumeDownload,
        stopDownload,

        getDownload,
        getProgress,
        getStatus,
        isDownloading,
    };
}
