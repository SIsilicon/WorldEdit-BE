/**
 * Turn text into colored text that supports MCBE
 * @param {string} text The text you want to format to rainbow colors.
 * @returns {string}
 * @example rainbowText('This is rainbow text!');
 */
function rainbowText(text) {
    const rainbowCode = ['§4', '§c', '§6', '§e', '§g', '§2', '§a', '§b', '§3', '§9', '§5', '§d'];
    const letter = text.replace(/§./g, '').split('');
    let newMessage = '', rainbowIndex = 0;
    letter.forEach(letter => {
        if (letter !== ' ') {
            newMessage += `${rainbowCode[rainbowIndex]}${letter}`;
            rainbowIndex + 1 >= rainbowCode.length ? rainbowIndex = 0 : rainbowIndex++;
        }
        else
            newMessage += ' ';
    });
    return newMessage;
}
;
/**
 * This will display in text in thousands, millions and etc... For ex: "1400 -> "1.4k", "1000000" -> "1M", etc...
 * @param {number} number The number you want to convert
 * @returns {string}
 * @example compressNumber(15000);
 */
function compressNumber(value) {
    const types = ["", "k", "M", "G", "T", "P", "E", "Z", "Y"];
    const selectType = Math.log10(value) / 3 | 0;
    if (selectType == 0)
        return value;
    let scaled = value / Math.pow(10, selectType * 3);
    return scaled.toFixed(1) + types[selectType];
}
;
/**
 * Will format your number. For ex: "1400" -> "1,400", "1000000" -> "1,000,000", etc...
 * @param {number} number
 * @returns {string}
 * @example formatNumber(15000);
 */
function formatNumber(value) {
    if (typeof value !== 'number')
        return;
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
;
export function MS(value, { compactDuration, fullDuration, avoidDuration } = {}) {
    try {
        if (typeof value === 'string') {
            if (/^\d+$/.test(value))
                return Number(value);
            const durations = value.match(/-?\d*\.?\d+\s*?(years?|yrs?|weeks?|days?|hours?|hrs?|minutes?|mins?|seconds?|secs?|milliseconds?|msecs?|ms|[smhdwy])/gi);
            return durations ? durations.reduce((a, b) => a + toMS(b), 0) : null;
        }
        ;
        if (typeof value === 'number')
            return toDuration(value, { compactDuration, fullDuration, avoidDuration });
        throw new Error('Value is not a string or a number');
    }
    catch (err) {
        const message = isError(err)
            ? `${err.message}. Value = ${JSON.stringify(value)}`
            : 'An unknown error has occured.';
        throw new Error(message);
    }
    ;
}
;
/**
 * Convert Durations to milliseconds
 */
function toMS(value) {
    const number = Number(value.replace(/[^-.0-9]+/g, ''));
    value = value.replace(/\s+/g, '');
    if (/\d+(?=ms|milliseconds?)/i.test(value))
        return number;
    else if (/\d+(?=s)/i.test(value))
        return number * 1000;
    else if (/\d+(?=m)/i.test(value))
        return number * 60000;
    else if (/\d+(?=h)/i.test(value))
        return number * 3.6e+6;
    else if (/\d+(?=d)/i.test(value))
        return number * 8.64e+7;
    else if (/\d+(?=w)/i.test(value))
        return number * 6.048e+8;
    else if (/\d+(?=y)/i.test(value))
        return number * 3.154e+10;
}
;
/**
 * Convert milliseconds to durations
 */
function toDuration(value, { compactDuration, fullDuration, avoidDuration } = {}) {
    const absMs = Math.abs(value);
    const duration = [
        { short: 'd', long: 'day', ms: absMs / 8.64e+7 },
        { short: 'h', long: 'hour', ms: absMs / 3.6e+6 % 24 },
        { short: 'm', long: 'minute', ms: absMs / 60000 % 60 },
        { short: 's', long: 'second', ms: absMs / 1000 % 60 },
        { short: 'ms', long: 'millisecond', ms: absMs % 1000 },
    ];
    const mappedDuration = duration
        .filter(obj => obj.ms !== 0 && avoidDuration ? fullDuration && !avoidDuration.map(v => v.toLowerCase()).includes(obj.short) : obj.ms)
        .map(obj => `${Math.sign(value) === -1 ? '-' : ''}${compactDuration ? `${Math.floor(obj.ms)}${obj.short}` : `${Math.floor(obj.ms)} ${obj.long}${obj.ms === 1 ? '' : 's'}`}`);
    return fullDuration ? mappedDuration.join(compactDuration ? ' ' : ', ') : mappedDuration[0];
}
;
/**
 * A type guard for errors.
 */
function isError(error) {
    return typeof error === 'object' && error !== null && 'message' in error;
}
;
export { rainbowText, compressNumber, formatNumber };
