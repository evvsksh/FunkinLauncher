import { useEffect } from "react";

interface ToastProps {
    message: string;
    type?: "error" | "success";
    onClose: () => void;
}

export function Toast({ message, type = "success", onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const isError = type === "error";

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div
                className={`${
                    isError
                        ? "bg-red-500/10 border-red-500/50 text-red-400"
                        : "bg-green-500/10 border-green-500/50 text-green-400"
                } border backdrop-blur-md px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-2xl`}
            >
                <div
                    className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                        isError ? "bg-red-500" : "bg-green-500"
                    }`}
                />
                <span className="text-[11px] font-bold tracking-wide uppercase">
                    {message}
                </span>
                <button onClick={onClose} className="ml-2 hover:opacity-50">
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                    >
                        <line x1="2" y1="2" x2="14" y2="14" />
                        <line x1="14" y1="2" x2="2" y2="14" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
