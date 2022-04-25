
function date() {
    return `[${new Date().toLocaleTimeString()}]`
}

class Console {
    
    log(...msg) {
        console.log(date(), ...msg);
    }
    
    warn(...msg) {
        console.warn(date(), ...msg);
    }

    error(...msg) {
        console.error(date(), ...msg);
        if (msg[0]?.stack) {
            console.error(msg[0].stack);
        }
    }
    
    stack() {
        warn(new Error().stack);
    }
}

export const contentLog = new Console(); 