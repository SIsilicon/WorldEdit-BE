
function log(...msg) {
    console.log(...msg);
}

function warn(...msg) {
    console.warn(...msg);
}

function error(...msg) {
    console.error(...msg);
}

function stack() {
    warn(new Error().stack);
}

export {log, warn, error, stack}