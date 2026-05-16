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
    downloadedBytes?: number;
    totalBytes?: number;
    speed?: number;
}

interface DownloadEvent {
    downloadId: string;
    downloadedBytes: number;
    totalBytes: number;
    percent: number;
    speed: number;
}

export function useDownloadManager() {
    const [downloads, setDownloads] = useState<Record<string, ActiveDownload>>(
        {},
    );

    const listenersRef = useRef<null | (() => void)[]>(null);

    useEffect(() => {
        const setup = async () => {
            const unlistenProgress = await listen<DownloadEvent>(
                "download-progress",
                (event) => {
                    const data = event.payload;

                    setDownloads((prev) => {
                        const existing = prev[data.downloadId];
                        if (!existing) return prev;

                        return {
                            ...prev,
                            [data.downloadId]: {
                                ...existing,
                                progress: data.percent,
                                downloadedBytes: data.downloadedBytes,
                                totalBytes: data.totalBytes,
                                speed: data.speed,
                                status:
                                    data.percent >= 100
                                        ? "downloaded"
                                        : "downloading",
                            },
                        };
                    });
                },
            );

            const unlistenComplete = await listen<{ downloadId: string }>(
                "download-complete",
                (event) => {
                    const { downloadId } = event.payload;

                    setDownloads((prev) => {
                        const existing = prev[downloadId];
                        if (!existing) return prev;

                        return {
                            ...prev,
                            [downloadId]: {
                                ...existing,
                                progress: 100,
                                status: "downloaded",
                                speed: 0,
                            },
                        };
                    });

                    setTimeout(() => {
                        setDownloads((prev) => {
                            const copy = { ...prev };
                            delete copy[downloadId];
                            return copy;
                        });
                    }, 3000);
                },
            );

            const unlistenFailed = await listen<{ downloadId: string }>(
                "download-failed",
                (event) => {
                    const { downloadId } = event.payload;

                    setDownloads((prev) => {
                        const existing = prev[downloadId];
                        if (!existing) return prev;

                        return {
                            ...prev,
                            [downloadId]: {
                                ...existing,
                                status: "error",
                                speed: 0,
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
        };
    }, []);

    const startDownload = useCallback(async (mod: Mod, file: ModFile) => {
        const downloadId = `${mod._idRow}-${file._idRow ?? file._sDownloadUrl}`;
        const modId = mod._idRow.toString();

        setDownloads((prev) => ({
            ...prev,
            [downloadId]: {
                downloadId,
                modId,
                file,
                url: file._sDownloadUrl,
                progress: 0,
                status: "downloading",
                downloadedBytes: 0,
                totalBytes: 0,
                speed: 0,
            },
        }));

        try {
            await invoke("download_mod", {
                downloadId,
                modId,
                url: file._sDownloadUrl,
            });
        } catch {
            setDownloads((prev) => ({
                ...prev,
                [downloadId]: {
                    ...prev[downloadId],
                    status: "error",
                },
            }));
        }
    }, []);

    const pauseDownload = useCallback(async (downloadId: string) => {
        await invoke("pause_download", { downloadId });

        setDownloads((prev) => ({
            ...prev,
            [downloadId]: {
                ...prev[downloadId],
                status: "paused",
            },
        }));
    }, []);

    const resumeDownload = useCallback(async (downloadId: string) => {
        await invoke("resume_download", { downloadId });

        setDownloads((prev) => ({
            ...prev,
            [downloadId]: {
                ...prev[downloadId],
                status: "downloading",
            },
        }));
    }, []);

    const stopDownload = useCallback(async (downloadId: string) => {
        await invoke("stop_download", { downloadId });

        setDownloads((prev) => {
            const copy = { ...prev };
            delete copy[downloadId];
            return copy;
        });
    }, []);

    const getProgress = useCallback(
        (downloadId: string) => downloads[downloadId]?.progress ?? 0,
        [downloads],
    );

    const getStatus = useCallback(
        (downloadId: string) => downloads[downloadId]?.status ?? "idle",
        [downloads],
    );

    const getSpeed = useCallback(
        (downloadId: string) => downloads[downloadId]?.speed ?? 0,
        [downloads],
    );

    return {
        downloads,
        startDownload,
        pauseDownload,
        resumeDownload,
        stopDownload,
        getProgress,
        getStatus,
        getSpeed,
    };
}