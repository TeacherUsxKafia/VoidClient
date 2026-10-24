import features from "void-features";
import { voidClient } from "../client.js";

/**
 * Runs every ES module in src/frontend/modules/features/ (files starting with "_" are skipped).
 * The list is generated while the bundle is built (esbuild.config.mjs), so adding a feature is: drop in a file, build.
 * A feature that throws is logged and skipped, it never stops the others or the game.
 */
export async function loadFeatures(){
    for (const feature of features){
        try {
            const module = await feature.load();
            if (typeof module.default === "function") await module.default(voidClient);
        }
        catch (error){
            console.error(`[voidClient] feature "${feature.name}" failed:`, error);
        }
    }
}
