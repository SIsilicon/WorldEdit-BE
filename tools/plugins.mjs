/* global console */
import fs from "fs";
import path from "path";

export let infoPlugin = function () {
    return {
        name: "infoPlugin",
        setup(build) {
            let start = Date.now();
            build.onStart(() => {
                console.log("\u{1F528} Building...");
                start = Date.now();
            });
            build.onEnd((result) => {
                let end = Date.now();
                const diff = end - start;
                console.log(`\u{2705} Build completed in ${diff}ms with ${result.warnings.length} warnings and ${result.errors.length} errors.`);
            });
        },
    };
};

export let transformerPlugin = function (filter, transformers) {
    return {
        name: "transformerPlugin",
        setup(build) {
            build.onLoad({ filter }, (args) => {
                let contents = fs.readFileSync(args.path, "utf8");
                for (const transformer of transformers) {
                    contents = transformer(args.path, contents) ?? contents;
                }
                return { contents, loader: path.extname(args.path).slice(1) };
            });
        },
    };
};
