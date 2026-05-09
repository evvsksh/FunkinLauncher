import { Signale } from "signale";

export const log = new Signale({
    scope: "FunkinLauncher",
    interactive: true,
    types: {
        note: {
            badge: "♪",
            color: "magenta",
            label: "note",
            logLevel: "info",
        },
    },
});
