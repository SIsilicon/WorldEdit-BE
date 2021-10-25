
type textElement = {
    text: string
};
type translateElement = {
    translate: string,
    with: string[]
};
type rawTextElement = textElement | translateElement;

export class RawText {
    private rawtext: rawTextElement[] = [];
    private lastElementIdx: number;

    public with(text: string) {
        const raw = new RawText();
        raw.rawtext = this.rawtext;
        raw.lastElementIdx = this.lastElementIdx;
        const element = <translateElement> raw.rawtext[this.lastElementIdx];
        if (element?.translate) {
            element.with.push(text);
        }
        return raw;
    }

    public prepend(type: 'text' | 'translate', data: string) {
        const raw = new RawText();
        raw.rawtext = this.rawtext;
        if (type == 'text') {
            raw.rawtext.unshift({
                'text': data,
            });
        } else {
            raw.rawtext.unshift({
                'translate': data,
                'with': []
            });
        }
        raw.lastElementIdx = 0;
        return raw;
    }

    public append(type: 'text' | 'translate', data: string) {
        const raw = new RawText();
        raw.rawtext = this.rawtext;
        if (type == 'text') {
            raw.rawtext.push({
                'text': data,
            });
        } else {
            raw.rawtext.push({
                'translate': data,
                'with': []
            });
        }
        raw.lastElementIdx = raw.rawtext.length - 1;
        return raw;
    }
    
    public static translate(translationKey: string) {
        const raw = new RawText();
        raw.rawtext.push({
            translate: translationKey,
            with: []
        });
        raw.lastElementIdx = 0;
        return raw;
    }

    public static text(text: string) {
        const raw = new RawText();
        raw.rawtext.push({
            text: text
        });
        raw.lastElementIdx = 0;
        return raw;
    }

    public toString(): string {
        return JSON.stringify(this);
    }
}