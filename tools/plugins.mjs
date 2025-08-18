/* global console */
export let infoPlugin = {
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
