import { voidClient } from "../../client.js";
import { registry, canLoadLive, loadScripts } from "./registry.js";
import { reloadStylesheets } from "./stylesheets.js";

voidClient.userscriptManager = {
    open: () => {
        import("./userscripts.js").then((module) => module.open()).catch((error) => console.error("[voidClient] userscript manager:", error));
    },
};
// here and not in the manager, so the settings checkbox works before the manager was ever opened
voidClient.settings.toggleUserscripts = (/** @type {boolean} */ on) => {
    // changeSetting stores the value after calling this, the manager reads it right away
    voidClient.settings.data.userscripts = on;
    if (!on){
        const kept = (registry?.entries ?? [])
            .filter((entry) => (entry.state === "running" || entry.state === "waiting") && !entry.stop())
            .map((entry) => entry.meta.name || entry.key);
        if (kept.length) voidClient.showNotification(`${kept.join(", ")} cannot be stopped and keeps running until the next refresh.`, false, 6);
    }
    else if (canLoadLive()) loadScripts(null, false, true);
    else if (!voidClient.userscriptManager.masterChanged) voidClient.showNotification("Refresh the page to start your userscripts.", false, 5);
    voidClient.userscriptManager.masterChanged?.(on);
};
// the exe reports swaps that changed on disk, also while the swapper manager is closed
window.chrome.webview.addEventListener("message", (/** @type {{ data: any }} */ event) => {
    const css = event.data?.swapperChanged?.css;
    if (Array.isArray(css) && css.length) reloadStylesheets(new Set(css.map(String)));
});
voidClient.swapperManager = {
    open: () => {
        import("./swapper.js").then((module) => module.open()).catch((error) => console.error("[voidClient] swapper manager:", error));
    },
};
