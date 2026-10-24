import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { build, transform } from "esbuild";

// the word "Void Client" in text players read becomes the client name from branding.json (VoidSettings and similar names stay)
const brand = (/** @type {string} */ text) => text.replace(/Void Client/g, () => String(branding.name));

/**
 * @type {import("esbuild").Plugin}
 */
export const brandPlugin = {
    name: "brandPlugin",
    setup(pluginBuild){
        pluginBuild.onLoad({ filter: /src[\\/](frontend[\\/].*\.js|cSettings\.json)$/ }, async(args) => ({
            loader: args.path.endsWith(".json") ? "json" : "js",
            contents: brand(await readFile(args.path, "utf8")),
        }));
    },
};

/**
 * `import features from "void-features"` is a list of every .js file in src/frontend/modules/features/ (not those starting with "_").
 * That is the whole "add a feature" mechanism, see the README in that folder.
 *
 * @type {import("esbuild").Plugin}
 */
export const featuresPlugin = {
    name: "featuresPlugin",
    setup(pluginBuild){
        const dir = path.resolve("src/frontend/modules/features");
        pluginBuild.onResolve({ filter: /^void-features$/ }, () => ({ path: "void-features", namespace: "void-features" }));
        pluginBuild.onLoad({ filter: /.*/, namespace: "void-features" }, async() => {
            const files = (await readdir(dir).catch(() => [])).filter((file) => file.endsWith(".js") && !file.startsWith("_")).sort();
            const items = files.map((file) => `{ name: ${JSON.stringify(file.slice(0, -3))}, load: () => import(${JSON.stringify(`./${file}`)}) }`);
            return { contents: `export default [${items.join(", ")}];`, loader: "js", resolveDir: dir, watchDirs: [dir] };
        });
    },
};

/**
 * @type {import("esbuild").Plugin}
 */
export const minifyCSS = {
    name: "minifyCSS",
    setup(pluginBuild){
        pluginBuild.onLoad({ filter: /\.css$/ }, async(args) => {
            const file = await readFile(args.path, "utf8");
            const css = await transform(file, { loader: "css", minify: true });
            return { loader: "text", contents: css.code };
        });
    },
};

/**
 * @type {import("esbuild").Plugin}
 */
export const textMinifyPlugin = {
    name: "textMinifyPlugin",
    setup(pluginBuild){
        pluginBuild.onLoad({ filter: /\.html$/ }, async(args) => {
            let contents = brand(await readFile(args.path, "utf8"));

            /** @type {string[]} */
            const scripts = [];
            let index = 0;

            // park scripts in placeholders so the whitespace collapse doesn't wreck them
            contents = contents.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, scriptContent) => {
                scripts.push(scriptContent);
                return `___SCRIPT_${index++}___`;
            });

            for (let i = 0; i < scripts.length; i++){
                const transformed = await transform(scripts[i], { loader: "js", minify: true });
                scripts[i] = transformed.code;
            }

            contents = contents.replace(/\s+/g, " ").trim();

            for (let i = 0; i < scripts.length; i++){
                const minifiedCode = scripts[i];
                contents = contents.replace(`___SCRIPT_${i}___`, `<script>${minifiedCode}</script>`);
            }

            return { loader: "text", contents };
        });
    },
};

/**
 * `import code from "popup-script:./queue.js"` gives the minified source as a string, for code injected elsewhere.
 *
 * @type {import("esbuild").Plugin}
 */
export const popupScriptPlugin = {
    name: "popupScriptPlugin",
    setup(pluginBuild){
        pluginBuild.onResolve({ filter: /^popup-script:/ }, (args) => ({
            path: path.resolve(args.resolveDir, args.path.slice("popup-script:".length)),
            namespace: "popup-script",
        }));
        pluginBuild.onLoad({ filter: /.*/, namespace: "popup-script" }, async(args) => {
            const source = await readFile(args.path, "utf8");
            const result = await transform(source, { loader: "js", minify: true });
            return { loader: "text", contents: result.code, watchFiles: [args.path] };
        });
    },
};

// name and repo come from branding.json, `bun run rebrand` edits that file
const branding = JSON.parse(readFileSync(new URL("./branding.json", import.meta.url), "utf8"));

console.log("Starting esbuild process...");
await build({
    entryPoints: ["./src/frontend/main.js"],
    bundle: true,
    minify: true,
    format: "iife",
    treeShaking: true,
    minifyWhitespace: true,
    minifySyntax: true,
    ignoreAnnotations: true,
    loader: {
        ".html": "text",
        ".webp": "dataurl",
        ".png": "dataurl",
        ".ogg": "base64",
    },
    define: {
        __CLIENT_NAME__: JSON.stringify(String(branding.name)),
    },
    outfile: "./target/bundle.js",
    plugins: [featuresPlugin, brandPlugin, textMinifyPlugin, minifyCSS, popupScriptPlugin],
})
    .then(() => {
        console.log("Build completed successfully!");
    })
    .catch((error) => {
        console.error("Build failed:", error);
        process.exit(1);
    });
