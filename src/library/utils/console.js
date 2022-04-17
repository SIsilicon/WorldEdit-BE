
function date() {
    return `[${new Date().toLocaleTimeString()}]`
}

function log(...msg) {
    console.log(date(), ...msg);
}

function warn(...msg) {
    console.warn(date(), ...msg);
}

function error(...msg) {
    console.error(date(), ...msg);
    if (msg[0]?.stack) {
        console.error(msg[0].stack);
    }
}

function stack() {
    warn(new Error().stack);
}

export {log, warn, error, stack}