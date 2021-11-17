export class RawText {
    constructor() {
        this.rawtext = [];
    }
    with(text) {
        const raw = new RawText();
        raw.rawtext = this.rawtext;
        raw.lastElementIdx = this.lastElementIdx;
        const element = raw.rawtext[this.lastElementIdx];
        if (element?.translate) {
            element.with.push(`${text}`);
        }
        return raw;
    }
    prepend(type, data) {
        const raw = new RawText();
        raw.rawtext = this.rawtext;
        if (type == 'text') {
            raw.rawtext.unshift({
                'text': data,
            });
        }
        else {
            raw.rawtext.unshift({
                'translate': data,
                'with': []
            });
        }
        raw.lastElementIdx = 0;
        return raw;
    }
    append(type, data) {
        const raw = new RawText();
        raw.rawtext = this.rawtext;
        if (type == 'text') {
            raw.rawtext.push({
                'text': data,
            });
        }
        else {
            raw.rawtext.push({
                'translate': data,
                'with': []
            });
        }
        raw.lastElementIdx = raw.rawtext.length - 1;
        return raw;
    }
    static translate(translationKey) {
        const raw = new RawText();
        raw.rawtext.push({
            translate: translationKey,
            with: []
        });
        raw.lastElementIdx = 0;
        return raw;
    }
    static text(text) {
        const raw = new RawText();
        raw.rawtext.push({
            text: text
        });
        raw.lastElementIdx = 0;
        return raw;
    }
    toString() {
        return JSON.stringify(this);
    }
}
