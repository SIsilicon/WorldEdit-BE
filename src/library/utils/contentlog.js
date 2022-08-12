/* eslint-disable no-undef */
import { DEBUG } from "@config.js";

function date() {
  return `[${new Date().toLocaleTimeString()}]`;
}

class Console {

  log(...msg) {
    console.warn("[LOG]", date(), ...msg);
  }

  warn(...msg) {
    console.warn("[WARN]", date(), ...msg);
  }

  error(...msg) {
    console.error("[ERROR]", date(), ...msg);
    if (msg[0]?.stack) {
      console.error(msg[0].stack);
    }
  }

  debug(...msg) {
    if (DEBUG) {
      console.warn("[DEBUG]", date(), ...msg);
    }
  }

  stack() {
    return new Error().stack.split("\n").splice(1).join("\n");
  }
}

export const contentLog = new Console();