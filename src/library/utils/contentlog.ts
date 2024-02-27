/* eslint-disable @typescript-eslint/no-explicit-any */
import config from "config";

function date() {
    return `[${new Date().toLocaleTimeString()}]`;
}

class ContentLog {
    verbose(...msg: any[]) {
        console.log("[VERBOSE]", date(), ...msg);
    }

    log(...msg: any[]) {
        console.warn("[LOG]", date(), ...msg);
    }

    warn(...msg: any[]) {
        console.warn("[WARN]", date(), ...msg);
    }

    error(...msg: any[]) {
        console.error("[ERROR]", date(), ...msg);
        if (msg[0]?.stack) {
            console.error(msg[0].stack);
        }
    }

    debug(...msg: any[]) {
        if (config.debug) {
            console.warn("[DEBUG]", date(), ...msg);
        }
    }

    stack() {
        return new Error().stack.split("\n").splice(1).join("\n");
    }
}

export const contentLog = new ContentLog();
