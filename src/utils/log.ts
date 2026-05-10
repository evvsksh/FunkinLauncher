type LogType =
    | "info"
    | "success"
    | "warn"
    | "error"
    | "note"
    | "pending"
    | "debug"
    | "await"
    | "complete";

interface LogConfig {
    badge: string;
    color: string;
    label: string;
}

const config: Record<LogType, LogConfig> = {
    info: { badge: "ℹ", color: "#007aff", label: "info" },
    success: { badge: "✔", color: "#34c759", label: "success" },
    warn: { badge: "⚠", color: "#ffcc00", label: "warning" },
    error: { badge: "✖", color: "#ff3b30", label: "error" },
    note: { badge: "♪", color: "#ff2d55", label: "note" },
    pending: { badge: "…", color: "#5856d6", label: "pending" },
    debug: { badge: "⚙", color: "#8e8e93", label: "debug" },
    await: { badge: "⏳", color: "#007aff", label: "awaiting" },
    complete: { badge: "☑", color: "#af52de", label: "complete" },
};

const SCOPE = "FunkinLauncher";
const SCOPE_STYLE = "color: #8e8e93; font-weight: bold;";

const createLogger = (type: LogType) => {
    const { badge, color, label } = config[type];
    const badgeStyle = `color: white; background: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: bold;`;
    const labelStyle = `color: ${color}; font-weight: bold;`;

    return async (msg: string, ...args: any[]): Promise<void> => {
        let method: "log" | "warn" | "error" | "debug" = "log";

        if (type === "warn") method = "warn";
        else if (type === "error") method = "error";
        else if (type === "debug") method = "debug";

        console[method](
            `%c${SCOPE}%c %c${badge}%c %c${label}%c ${msg}`,
            SCOPE_STYLE,
            "",
            badgeStyle,
            "",
            labelStyle,
            "",
            ...args,
        );
    };
};

export const log = {
    info: createLogger("info"),
    success: createLogger("success"),
    warn: createLogger("warn"),
    error: createLogger("error"),
    note: createLogger("note"),
    pending: createLogger("pending"),
    debug: createLogger("debug"),
    await: createLogger("await"),
    complete: createLogger("complete"),
};
