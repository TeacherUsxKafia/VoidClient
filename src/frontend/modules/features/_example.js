// Copy this file to something like "myFeature.js" (no leading underscore) and it is part of the build.

/**
 * @param {any} voidClient the client object, see README.md in this folder
 */
export default function(voidClient){
    // pretend setting: add "myFeature" to src/cSettings.json first, or delete this line to always run
    // if (!voidClient.settings.data.myFeature) return;

    console.log("[example feature] running");

    // shows up in Hotkeys > "Keys from userscripts and features"
    (voidClient.hotkeyHints ??= []).push({ source: "Example feature", label: "Say hello", key: "F7" });

    window.addEventListener("keydown", (event) => {
        if (event.code !== "F7" || event.repeat) return;
        voidClient.showNotification("Hello from the example feature", false, 3);
    });
}
