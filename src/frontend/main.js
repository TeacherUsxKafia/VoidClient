import styles from "./components/base.css";
import { voidClient, ready, globalRef } from "./client.js";
import { hook, getElement, checkCompMode } from "./utils.js";
import { setRampBoost, syncScrollBinds } from "./modules/rampBoost.js";
import { prepareShootBind, syncLeftClick } from "./modules/leftClick.js";
// static import: the host only hands over the userscript registry during bundle eval
import "./modules/managers/registry.js";
// static import: the host hands over the CSS (bundled defaults + your css folder) during bundle eval
import "./modules/customCss.js";
// static import: a hung load never reaches gameLoaded
import "./modules/sessionRecovery.js";

// __CLIENT_NAME__ comes from branding.json, see esbuild.config.mjs
const CLIENT_NAME = __CLIENT_NAME__;

// default to advanced settings, otherwise client settings are invisible. unset = never chose
if (localStorage.getItem("krk_advanced") === null) localStorage.setItem("krk_advanced", "1");

let initialLoad = true;
window.OffCliV = true;
window.closeClient = () => window.chrome.webview.postMessage("close");

document.addEventListener(
    "DOMContentLoaded",
    () => {
        prepareShootBind();
        import("./modules/splash.js");
        import("./modules/gameFpsLimit.js");

        const baseCSS = document.createElement("style");
        baseCSS.textContent = styles;
        document.head.append(baseCSS);

        /** @type {((event: WheelEvent) => void)|null} */
        let wheelListener = null;
        hook(HTMLCanvasElement, "addEventListener", (args) => {
            const [type, listener] = args;
            if (type === "wheel") wheelListener = listener;
        });

        // host forwards WM_MOUSEWHEEL while pointer is locked
        window.chrome.webview.addEventListener("message", (event) => {
            if (typeof event.data?.wheel === "number") wheelListener?.(new WheelEvent("wheel", { deltaY: event.data.wheel }));
        });

        // a wheel gesture over nothing scrollable still runs chromium's scroll path and cost menu fps
        window.addEventListener("wheel", (event) => {
            if (document.pointerLockElement) return;
            // composedPath, not target: our popups live in shadow roots and target is retargeted to the host
            for (const el of event.composedPath()){
                if (el === document.body || el === document.documentElement) break;
                if (!(el instanceof Element)) continue;
                const style = getComputedStyle(el);
                const scrollsY = (style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollHeight > el.clientHeight;
                const scrollsX = (style.overflowX === "auto" || style.overflowX === "scroll") && el.scrollWidth > el.clientWidth;
                if (scrollsY || scrollsX) return;
            }
            event.preventDefault();
        }, { capture: true, passive: false });

        hook(HTMLCanvasElement, "requestPointerLock", function(args, original){
            syncLeftClick();
            syncScrollBinds();
            window.chrome.webview.postMessage("drag, false");
            window.chrome.webview.postMessage("throttle, game");

            // chromium has no unadjustedMovement on linux, asking for it rejects the lock (krunker's own raw mouse too)
            const unadjustedMovement = voidClient.platform !== "linux" && voidClient?.settings?.data?.rawInput;
            return original.call(this, { ...args[0], unadjustedMovement });
        });

        document.addEventListener("pointerlockchange", () => {
            if (!document.pointerLockElement){
                window.chrome.webview.postMessage("drag, true");
                window.chrome.webview.postMessage("throttle, menu");
            }
            else {
                // in case the requestPointerLock hook missed the transition
                window.chrome.webview.postMessage("throttle, game");
            }
        });
    },
    { once: true },
);

Object.defineProperty(window, "gameLoaded", {
    /**
     * @param {boolean} value
     */
    async set(value){
        if (!value) return;

        await ready;

        window.chrome.webview.postMessage("game-updated");
        if (!initialLoad) return;
        if (sessionStorage.getItem("justLaunched") === null) sessionStorage.setItem("justLaunched", "true");
        else sessionStorage.setItem("justLaunched", "false");

        initialLoad = false;
        // console is disabled without this
        localStorage.setItem("logs", "true");

        // the settings entry in krunker's menu, copies the look of the entry next to it
        /** @type {string|undefined} */
        let svelteCode;
        for (const cl of getElement("#clientExit .menuItemTitle").classList){
            if (cl.startsWith("svelte-")){
                svelteCode = cl;
                break;
            }
        }
        getElement("#clientExit").insertAdjacentHTML(
            "beforebegin",
            `<div onclick='${globalRef}.openVoidSettings()' class="menuItem ${svelteCode}"><span class="material-icons menuItemIcon ${svelteCode}">settings</span><div class="menuItemTitle ${svelteCode}">${CLIENT_NAME} Settings</div></div>`,
        );

        import("./notifications.js");
        import("./settings.js");
        import("./modules/managers/index.js");
        import("./modules/args.js");
        import("./modules/fixes.js");
        // always: toggle keys and the menu button
        import("./modules/hotkeys.js");
        // always: create button in the settings
        import("./modules/diagnostics.js");
        // only from an exe that is in safe mode, testing, or has a result
        if (voidClient.recovery) import("./modules/recovery.js");
        // always: it also puts the frame loop's potential into the game's counter, the present part needs renderStats
        import("./modules/renderFps.js");
        // your own ES module features: drop a file into src/frontend/modules/features/ (see the README there)
        import("./modules/featureLoader.js").then((module) => module.loadFeatures());
        if (voidClient?.settings?.data?.exitButton) getElement("#clientExit").style.display = "flex";

        if (voidClient?.settings?.data?.rampBoost && !checkCompMode()){
            setRampBoost(true);

            /**
             * @param {MessageEvent} event
             */
            const gameUpdateListener = (event) => {
                if (event.data === "game-updated"){
                    setTimeout(() => {
                        if (checkCompMode()){
                            window.chrome.webview.removeEventListener("message", gameUpdateListener);
                            setRampBoost(false);
                        }
                    }, 2000);
                }
            };

            window.chrome.webview.addEventListener("message", gameUpdateListener);
        }

        setTimeout(() => {
            if (sessionStorage.getItem("justLaunched") === "true" && voidClient?.launchArgs){
                voidClient.parseArgs(voidClient.launchArgs);
            }
        }, 2000);
    },
});
