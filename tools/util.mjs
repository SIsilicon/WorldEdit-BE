/* global console */
import process from "process";

export function exitMessage(message) {
    console.error(message);
    process.exit(1);
}
