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
                    const [modId, percent] = event.payload;

                    setDownloads((prev) => {
                        const existing = prev[modId];
                        if (!existing) return prev;

                        return {
                            ...prev,
                            [modId]: {
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
                    const modId = event.payload;

                    setDownloads((prev) => ({
                        ...prev,
                        [modId]: {
                            ...prev[modId],
                            status: "downloaded",
                            progress: 100,
                        },
                    }));
                },
            );

            const unlistenFailed = await listen<string>(
                "download-failed",
                (event) => {
                    const modId = event.payload;

                    setDownloads((prev) => ({
                        ...prev,
                        [modId]: {
                            ...prev[modId],
                            status: "error",
                        },
                    }));
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
        const modId = mod._idRow.toString();

        setDownloads((prev) => ({
            ...prev,
            [modId]: {
                modId,
                file,
                url: file._sDownloadUrl,
                progress: 0,
                status: "downloading",
            },
        }));

        await invoke("download_mod", {
            modId,
            url: file._sDownloadUrl,
        });
    }, []);

    const pauseDownload = useCallback(async (modId: string) => {
        await invoke("pause_download", { modId });

        setDownloads((prev) => ({
            ...prev,
            [modId]: {
                ...prev[modId],
                status: "paused",
            },
        }));
    }, []);

    const resumeDownload = useCallback(async (modId: string) => {
        await invoke("resume_download", { modId });

        setDownloads((prev) => ({
            ...prev,
            [modId]: {
                ...prev[modId],
                status: "downloading",
            },
        }));
    }, []);

    const stopDownload = useCallback(async (modId: string) => {
        await invoke("stop_download", { modId });

        setDownloads((prev) => {
            const copy = { ...prev };
            delete copy[modId];
            return copy;
        });
    }, []);

    const getDownload = useCallback(
        (modId: string) => downloads[modId],
        [downloads],
    );

    const isDownloading = useCallback(
        (modId: string) =>
            downloads[modId]?.status === "downloading" ||
            downloads[modId]?.status === "paused",
        [downloads],
    );

    const getProgress = useCallback(
        (modId: string) => downloads[modId]?.progress ?? 0,
        [downloads],
    );

    const getStatus = useCallback(
        (modId: string) => downloads[modId]?.status ?? "idle",
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
