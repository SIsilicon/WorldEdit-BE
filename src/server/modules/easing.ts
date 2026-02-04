import { CustomArgType } from "@notbeer-api";
import easingFunctions from "./extern/easingFunctions";

type EasingType = keyof typeof easingFunctions;

export class Easing implements CustomArgType {
    private easingFunction: (typeof easingFunctions)[EasingType];

    constructor(readonly type: EasingType = "linear") {
        this.easingFunction = easingFunctions[type];
    }

    evaluate(input: number) {
        return this.easingFunction(input);
    }

    clone() {
        const easing = new Easing(this.type);
        return easing;
    }

    toJSON() {
        return this.type;
    }

    static parseArgs(args: Array<string>, index = 0) {
        const easingType = args[index].toLowerCase().replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace("-", "").replace("_", ""));
        if (!(easingType in easingFunctions)) {
            throw "";
        }
        const easing = new Easing(easingType);
        return { result: easing, argIndex: index + 1 };
    }
}
