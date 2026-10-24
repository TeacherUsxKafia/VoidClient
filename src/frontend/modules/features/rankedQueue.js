// Ranked Queue: queue for ranked in a small window of its own, without waiting in the game, with a "match found" sound.
// A button appears in the ranked menu (next to the play buttons). One file: the queue window's page, style and script,
// the sound options and the map list are all in here. The sound itself is assets/match-found.ogg.
//
// It talks to Krunker's own matchmaking with your login token, nothing else is contacted.
// Volume: Settings > Game > Ranked Match Alert > Sound (saved as queueSoundVolume).
import { voidClient } from "../../client.js";

const DEFAULT_VOLUME = 40;
const MAPS_URL = "https://gapi.svc.krunker.io/maps";
// used when Krunker's map list does not answer. index = map number
const FALLBACK_MAPS = [
    "Burg", "Littletown", "Sandstorm", "Subzero", "Undergrowth", "Shipment", "Freight", "Lostworld", "Citadel", "Oasis",
    "Kanji", "Industry", "Lumber", "Evacuation", "Site", "SkyTemple", "Lagoon", "Bureau", "Tortuga", "Tropicano",
    "Krunk_Plaza", "Arena", "Habitat", "Atomic", "Old_Burg", "Throwback", "Stockade", "Facility", "Clockwork", "Laboratory",
    "Shipyard", "Soul Sanctum", "Bazaar", "Erupt", "HQ", "Khepri", "Lush", "Vivo", "Slide Moonlight", "Eterno Simulator",
    "Stalk Factory", "Eterno Jump", "Frontier", "Bastion", "Piazza", "Barnyard",
];

/** @return {number} 0 to 1, read when the sound plays so the slider applies to an open queue window */
const volume = () => Math.min(1, Math.max(0, Number(voidClient.settings.data.queueSoundVolume ?? DEFAULT_VOLUME) / 100 || 0));

/** @return {Promise<string>} the sound as base64, loaded only when it is needed */
const matchFoundSound = () => import("./assets/match-found.ogg").then((module) => module.default);

/**
 * "eterno_jump" becomes "Eterno Jump"
 *
 * @param {string} name
 * @return {string}
 */
const label = (name) => name.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

/** @type {Promise<{number: number, name: string}[]>|null} */
let liveMaps = null;

/**
 * Krunker's live map list, so a map added mid season is queued too. The built in list when Krunker does not answer.
 *
 * @return {Promise<{number: number, name: string}[]>}
 */
function officialMaps(){
    liveMaps ??= fetch(MAPS_URL, { signal: AbortSignal.timeout(4000) })
        .then((response) => response.json())
        .then((body) => {
            /** @type {{number: number, name: string}[]} */
            const maps = [];
            for (const entry of Array.isArray(body?.data) ? body.data : []){
                if (Number.isInteger(entry?.id) && entry.id >= 0 && typeof entry?.name === "string") maps.push({ number: entry.id, name: label(entry.name) });
            }
            if (maps.length === 0) throw new Error("empty map list");
            return maps;
        })
        .catch(() => {
            liveMaps = null;
            return FALLBACK_MAPS.map((name, number) => ({ number, name: label(name) }));
        });
    return liveMaps;
}

// ---------------------------------------------------------------------------------------------------------------------
// the sound options (volume and a play button)

const OPTIONS_HTML = `<style>
#qsPanel { box-sizing: border-box; width: 420px; max-width: 92vw; padding: 1.6em 2em 1.4em; background: #0d1530; color: #fff;
	border-top: 4px solid #5aa9ff; font-family: GameFont, sans-serif; box-shadow: 0 8px 48px #000c; }
#qsPanel h2 { margin: 0 0 0.8em; font-size: 1.5em; letter-spacing: 0.14em; text-transform: uppercase; }
#qsRow { display: flex; align-items: center; gap: 0.8em; }
#qsVolume { flex: 1; accent-color: #5aa9ff; }
#qsVolumeValue { width: 3.5em; text-align: right; }
#qsError { margin-top: 0.7em; color: #eb5656; font-size: 0.9em; }
#qsActions { display: flex; gap: 0.7em; margin-top: 1.2em; }
.qsButton { flex: 1; padding: 0.6em; background: #22305f; text-align: center; cursor: pointer; user-select: none; }
.qsButton:hover { color: #5aa9ff; }
#qsHint { margin-top: 0.9em; color: #8c9bc4; font-size: 0.8em; }
</style>
<div id="qsPanel">
	<h2>Match found sound</h2>
	<div id="qsRow"><input id="qsVolume" type="range" min="0" max="100" step="1"><span id="qsVolumeValue"></span></div>
	<div id="qsError" hidden></div>
	<div id="qsActions"><div class="qsButton" id="qsPlay">Play</div><div class="qsButton" id="qsDone">Done</div></div>
	<div id="qsHint">The sound plays when the ranked queue finds a match. Full volume is much louder than the game.</div>
</div>`;

class QueueSound {
    constructor(){
        /** @type {AudioContext|null} */
        this.context = null;
        /** @type {AudioBufferSourceNode|null} */
        this.playing = null;
        /** @type {GainNode|null} */
        this.gain = null;
    }

    /**
     * @param {string} base64
     */
    async play(base64){
        this.stop();
        this.context ??= new AudioContext();
        if (this.context.state === "suspended") await this.context.resume();
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const buffer = await this.context.decodeAudioData(bytes.buffer);
        const gain = this.context.createGain();
        gain.gain.value = volume();
        gain.connect(this.context.destination);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        source.onended = () => {
            if (this.playing === source) this.playing = null;
            source.disconnect();
            gain.disconnect();
        };
        source.start();
        this.playing = source;
        this.gain = gain;
    }

    stop(){
        this.playing?.stop();
        this.playing = null;
    }

    showOptions(){
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;justify-content:center;align-items:center;background:rgba(4,8,20,0.7)";
        const host = document.createElement("div");
        overlay.append(host);
        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = OPTIONS_HTML;
        /**
         * @param {string} id
         * @return {HTMLElement}
         */
        const element = (id) => /** @type {HTMLElement} */ (shadow.querySelector(`#${id}`));
        const slider = /** @type {HTMLInputElement} */ (element("qsVolume"));
        const savedVolume = Math.round(volume() * 100);
        const showVolume = () => {
            element("qsVolumeValue").textContent = `${slider.value} %`;
        };
        slider.value = String(savedVolume);
        showVolume();
        // live, so Play and an open queue window use it right away. stored on close
        slider.oninput = () => {
            voidClient.settings.data.queueSoundVolume = Number(slider.value);
            showVolume();
            if (this.playing && this.gain) this.gain.gain.value = volume();
        };
        element("qsPlay").onclick = async() => {
            const error = element("qsError");
            error.hidden = true;
            try {
                await this.play(await matchFoundSound());
                if (volume() === 0){
                    error.textContent = "The volume is at 0.";
                    error.hidden = false;
                }
            }
            catch {
                error.textContent = "The sound cannot be played.";
                error.hidden = false;
            }
        };

        const controller = new AbortController();
        const close = () => {
            controller.abort();
            this.stop();
            overlay.remove();
            if (Number(slider.value) !== savedVolume) window.chrome.webview.postMessage(`set-config-json queueSoundVolume ${Number(slider.value)}`);
        };
        element("qsDone").onclick = close;
        overlay.addEventListener("mousedown", (event) => {
            if (event.target === overlay) close();
        });
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            close();
        }, { signal: controller.signal, capture: true });
        document.body.append(overlay);
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// the queue window (a popup). Its page, style and script, handed over as text because the popup starts as about:blank

const POPUP_CSS = `
* { user-select: none; margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: "Trebuchet MS", sans-serif; background: #070d20; min-height: 100vh; display: flex; align-items: center; justify-content: center; color: #e0e6ff; overflow: hidden; }
.queuer { position: relative; background: #0d1530; padding: 40px 52px; max-width: 1000px; width: 90vw; border: 2px solid #22305f; border-top: 3px solid #5aa9ff; box-shadow: 0 4px 24px rgba(0,0,0,0.7); }
.main { display: flex; align-items: center; gap: 56px; }
.left { flex: 1; display: flex; flex-direction: column; gap: 24px; }
.status { display: flex; align-items: center; gap: 14px; position: relative; padding-left: 18px; }
.status::before { content: ""; position: absolute; left: 0; width: 8px; height: 8px; background: #66709a; border-radius: 50%; transition: background 0.3s ease; }
.status.active::before { background: #5aa9ff; box-shadow: 0 0 12px rgba(90,169,255,0.6); }
#queueStatus { font-size: 14px; font-weight: 600; color: #66709a; text-transform: uppercase; letter-spacing: 1px; transition: color 0.3s ease; }
#queueStatus.active { color: #5aa9ff; }
.timer { font-size: 52px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; padding: 12px 16px; background: #141e40; border-left: 3px solid #5aa9ff; border-radius: 2px; }
.regions { display: flex; gap: 12px; }
.region input { display: none; }
.region label { display: block; padding: 12px 24px; background: #141e40; border: 2px solid #22305f; border-radius: 4px; color: #8c9bc4; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; transition: all 0.2s ease; }
.region label:hover { background: #1a2650; }
.region input:checked + label { background: rgba(90,169,255,0.12); border-color: #5aa9ff; color: #5aa9ff; }
.divider { width: 1px; height: 120px; background: #22305f; }
.right { display: flex; flex-direction: column; gap: 14px; }
.btn { padding: 16px 42px; border: 2px solid #5aa9ff; font-size: 20px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-family: "Trebuchet MS", sans-serif; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px; background: #5aa9ff; color: #fff; }
.btn:hover:not(:disabled) { background: #7bbcff; border-color: #7bbcff; }
.btn:active:not(:disabled) { transform: scale(0.98); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.in-queue { background: #141e40; color: #5aa9ff; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; opacity: 0; visibility: hidden; transition: all 0.3s ease; z-index: 1000; }
.overlay.active { opacity: 1; visibility: visible; }
.popup { background: #0d1530; border: 2px solid #22305f; border-top: 3px solid #5aa9ff; max-width: 560px; width: 90vw; box-shadow: 0 12px 48px rgba(0,0,0,0.8); position: relative; text-align: center; padding: 8px 0 20px; border-radius: 4px; }
.popup h2 { margin-top: 12px; font-size: 32px; font-weight: 700; color: #5aa9ff; text-transform: uppercase; letter-spacing: 1.5px; }
.popup-content { margin: 20px 0; }
.found { font-size: 18px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 1px; display: inline-block; padding: 12px 24px; background: rgba(90,169,255,0.15); border: 2px solid #5aa9ff; border-radius: 4px; }
#matchFoundMessage { margin: 12px auto 0; font-size: 20px; color: #fff; width: 400px; max-width: 90%; }
.countdown { font-size: 48px; font-weight: 700; color: #5aa9ff; margin: 16px 0; font-variant-numeric: tabular-nums; line-height: 1; }
#closeButton { position: absolute; right: 0; top: 0; margin: 10px 20px 0 0; font-size: 20px; cursor: pointer; }
`;

const POPUP_BODY = `
<div class="queuer"><div class="main">
	<div class="left">
		<div class="status" id="statusArea"><span id="queueStatus">Ready</span></div>
		<div class="timer" id="queueTimerDisplay">00:00:00</div>
		<div class="regions" id="regionCheckboxes">
			<div class="region"><input type="checkbox" id="na" value="na"><label for="na">NA</label></div>
			<div class="region"><input type="checkbox" id="eu" value="eu"><label for="eu">EU</label></div>
			<div class="region"><input type="checkbox" id="as" value="as"><label for="as">Asia</label></div>
		</div>
	</div>
	<div class="divider"></div>
	<div class="right"><button type="button" class="btn" id="queueButton">Start Queue</button></div>
</div></div>
<div class="overlay" id="matchPopupOverlay"><div class="popup">
	<h2>Match Found</h2>
	<div class="popup-content">
		<div id="closeButton">X</div>
		<div class="found" id="foundRegion">Region: </div>
		<div id="matchFoundMessage">open the client and rejoin the game from the ranked menu</div>
		<div class="countdown" id="countDownTimer">00:00:60</div>
	</div>
</div></div>`;

// @popup-begin
/**
 * Runs inside the queue window as script text, so it must use nothing from this file. Input comes in window.info
 * (token, region, sound as base64, volume(), maps). It shares the game's main thread, keep it light.
 */
function queuePopupMain(){
    const info = /** @type {any} */ (window).info;

    /**
     * @param {string} selector
     * @return {HTMLElement}
     */
    function must(selector){
        const element = /** @type {HTMLElement|null} */ (document.querySelector(selector));
        if (!element) throw new Error(`queue window: ${selector} is missing`);
        return element;
    }

    const REGION_NAMES = /** @type {Record<string, string>} */ ({ na: "North America", eu: "Europe", as: "Asia" });
    const ACCEPT_SECONDS = 60;
    /** @type {number[]} */
    const mapNumbers = info.maps.map((/** @type {{number: number}} */ map) => map.number);
    /** @type {Record<number, string>} */
    const mapNames = Object.fromEntries(info.maps.map((/** @type {{number: number, name: string}} */ map) => [map.number, map.name]));

    const queueStatus = must("#queueStatus");
    const statusArea = must("#statusArea");
    const queueTimerDisplay = must("#queueTimerDisplay");
    const regionSelectors = must("#regionCheckboxes");
    const matchPopupOverlay = must("#matchPopupOverlay");
    const countdownTimer = must("#countDownTimer");
    const foundRegion = must("#foundRegion");
    const queueButton = /** @type {HTMLButtonElement} */ (must("#queueButton"));
    const closeButton = must("#closeButton");

    let isQueued = false;
    let isConnecting = false;
    let queueStartTime = 0;
    let queueInterval = 0;
    let countdownInterval = 0;
    /** @type {WebSocket|null} */
    let queueConnection = null;
    /** @type {AudioContext|null} */
    let audioContext = null;
    /** @type {AudioBuffer|null} */
    let notificationBuffer = null;
    /** @type {AudioBufferSourceNode|null} */
    let currentSource = null;

    // stored on the game page, survives the popup
    const storage = window.opener?.localStorage ?? window.localStorage;

    function saveSettings(){
        const regions = Array.from(regionSelectors.querySelectorAll("input:checked"), (checkbox) => checkbox.id);
        storage.setItem("void_queue_regions", JSON.stringify(regions));
    }

    function loadSettings(){
        try {
            for (const regionId of JSON.parse(storage.getItem("void_queue_regions") ?? "[]")){
                const checkbox = /** @type {HTMLInputElement|null} */ (document.getElementById(regionId));
                if (checkbox) checkbox.checked = true;
            }
        }
        catch {
            // nothing saved, nothing selected
        }
    }

    /**
     * @param {number} seconds
     * @return {string} hh:mm:ss
     */
    function formatTime(seconds){
        const pad = (/** @type {number} */ value) => String(Math.floor(value)).padStart(2, "0");
        return `${pad(seconds / 3600)}:${pad((seconds % 3600) / 60)}:${pad(seconds % 60)}`;
    }

    /**
     * @param {boolean} active shows "in queue"
     * @param {string} text
     */
    function showStatus(active, text){
        queueStatus.textContent = text;
        queueStatus.classList.toggle("active", active);
        statusArea.classList.toggle("active", active);
    }

    /**
     * @param {string} [text]
     */
    function showIdle(text = "Ready"){
        isQueued = false;
        isConnecting = false;
        clearInterval(queueInterval);
        queueButton.textContent = "Start Queue";
        queueButton.classList.remove("in-queue");
        queueButton.disabled = false;
        queueTimerDisplay.textContent = "00:00:00";
        showStatus(false, text);
    }

    // decode the sound on the first "Start Queue" click, an AudioContext wants a gesture anyway
    async function initializeAudio(){
        audioContext = new AudioContext();
        if (audioContext.state === "suspended") await audioContext.resume();
        notificationBuffer = await audioContext.decodeAudioData(Uint8Array.from(atob(info.sound), (char) => char.charCodeAt(0)).buffer);
    }

    function stopNotificationSound(){
        if (!currentSource) return;
        currentSource.stop();
        currentSource.disconnect();
        currentSource = null;
    }

    function playNotificationSound(){
        if (!notificationBuffer || audioContext?.state !== "running") return;
        stopNotificationSound();
        let level = 1;
        try {
            level = info.volume?.() ?? 1;
        }
        catch {
            // the main window is gone, full volume
        }
        if (!(level > 0)) return;
        const gain = audioContext.createGain();
        gain.gain.value = level;
        gain.connect(audioContext.destination);
        const source = audioContext.createBufferSource();
        source.buffer = notificationBuffer;
        source.connect(gain);
        source.start(0);
        currentSource = source;
        source.onended = () => {
            if (currentSource === source) currentSource = null;
            source.disconnect();
            gain.disconnect();
        };
    }

    /**
     * @param {number} milliseconds
     */
    function showCooldown(milliseconds){
        const endTime = Date.now() + milliseconds;
        const update = () => {
            const remaining = Math.ceil((endTime - Date.now()) / 1000);
            if (remaining <= 0){
                showStatus(false, "Ready");
                queueButton.disabled = false;
                return;
            }
            showStatus(false, `Cooldown: ${formatTime(remaining)}`);
            queueButton.disabled = true;
            setTimeout(update, 1000);
        };
        update();
    }

    /**
     * @param {string} map map number
     * @param {string} region two chars, then "na", "eu" or "as"
     */
    function matchFound(map, region){
        playNotificationSound();
        matchPopupOverlay.classList.add("active");

        const mapName = mapNames[Number.parseInt(map, 10)] ?? "unknown";
        const regionName = REGION_NAMES[region.slice(2)] ?? region.slice(2);
        foundRegion.textContent = `${regionName}, ${mapName}`;

        const startTime = Date.now();
        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            const remaining = Math.max(0, ACCEPT_SECONDS - Math.floor((Date.now() - startTime) / 1000));
            countdownTimer.textContent = formatTime(remaining);
            if (remaining <= 0){
                clearInterval(countdownInterval);
                matchPopupOverlay.classList.remove("active");
            }
        }, 1000);

        showIdle();
    }

    function startQueue(){
        const regions = Array.from(/** @type {NodeListOf<HTMLInputElement>} */ (regionSelectors.querySelectorAll("input:checked")), (input) => input.value);
        if (regions.length === 0){
            showIdle("Select at least one region");
            return;
        }

        const url = `wss://gamefrontend.svc.krunker.io/v1/matchmaking/queue?token=${info.token}&maps=${mapNumbers.join(",")}&regions=${regions.join(",")}`;
        /** @type {WebSocket} */
        let connection;
        try {
            connection = new WebSocket(url);
        }
        catch {
            showIdle("Connection failed");
            return;
        }
        queueConnection = connection;

        connection.onerror = () => showIdle("Connection error");
        connection.onclose = () => {
            // cooldown or match found already set their text
            if (isQueued || isConnecting) showIdle();
        };
        connection.onopen = () => {
            isQueued = true;
            isConnecting = false;
            queueStartTime = Date.now();
            queueButton.textContent = "Leave Queue";
            queueButton.classList.add("in-queue");
            queueButton.disabled = false;
            showStatus(true, "In queue");
            queueTimerDisplay.textContent = formatTime(0);
            queueInterval = setInterval(() => {
                queueTimerDisplay.textContent = formatTime((Date.now() - queueStartTime) / 1000);
            }, 1000);
        };
        connection.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "QUEUE_STATUS" && data.payload?.status === "MATCHED"){
                const found = data.payload.assignment.extensions;
                matchFound(String(found.map).trim(), String(found.region));
            }
            else if (data.type === "ERROR" && data.payload?.code === "COOLDOWN"){
                showIdle();
                connection.close();
                showCooldown(Number(data.payload.payload.cooldown));
            }
            else if (data.type === "INTERNAL_ERROR"){
                showIdle();
                connection.close();
            }
        };
    }

    loadSettings();
    // the region of the ranked menu beats the saved one
    const preset = /** @type {HTMLInputElement|null} */ (info.region ? document.getElementById(info.region) : null);
    if (preset) preset.checked = true;

    queueButton.onclick = async() => {
        if (isConnecting) return;
        if (isQueued){
            queueConnection?.close();
            return;
        }
        queueButton.disabled = true;
        isConnecting = true;
        try {
            if (!notificationBuffer) await initializeAudio();
        }
        catch {
            // queue anyway, just without the sound
        }
        startQueue();
    };

    closeButton.onclick = () => {
        clearInterval(countdownInterval);
        matchPopupOverlay.classList.remove("active");
        stopNotificationSound();
    };

    // regions are sent when connecting, changing one means queueing again
    const regionChanged = () => {
        if (isQueued) queueConnection?.close();
        saveSettings();
    };
    for (const input of regionSelectors.querySelectorAll("input")) input.onclick = regionChanged;
}
// @popup-end

function openQueueWindow(){
    const windowWidth = 850;
    const windowHeight = 350;
    const left = (window.screen.width - windowWidth) / 2;
    const top = (window.screen.height - windowHeight) / 2;
    /** @type {(Window & { info?: object })|null} */
    const queueWindow = window.open("about:blank", "_blank", `width=${windowWidth},height=${windowHeight},left=${left},top=${top}`);
    if (!queueWindow) return;

    let region = (document.querySelector(".region-indicator")?.textContent ?? "").split(": ")[1] ?? "";
    if (region === "North America") region = "na";
    else if (region === "Europe") region = "eu";
    else if (region === "Asia") region = "as";
    const token = (localStorage.getItem("__FRVR_auth_access_token") ?? "").replace(/"/g, "").replace("/", "");

    Promise.all([matchFoundSound(), officialMaps()]).then(([sound, maps]) => {
        // the popup reads this when it starts, and the volume when the sound plays
        queueWindow.info = { token, region, sound, volume, maps };
        const doc = queueWindow.document;
        doc.title = "Ranked Queue";
        const style = doc.createElement("style");
        style.textContent = POPUP_CSS;
        doc.head.append(style);
        doc.body.innerHTML = POPUP_BODY;
        // script last, it looks up its elements when it starts. created by the popup's document so it runs there
        const script = doc.createElement("script");
        script.textContent = `(${queuePopupMain.toString()})();`;
        doc.head.append(script);
    });
}

export default function rankedQueue(){
    const sound = new QueueSound();
    voidClient.queueSound = { showOptions: () => sound.showOptions() };

    const original = window.openRankedMenu;
    if (typeof original !== "function") return;

    /** @type {HTMLButtonElement} */
    const button = document.createElement("button");
    button.textContent = "open_in_new";
    button.title = "Open the ranked queue in its own window";
    button.style.cssText = "background-color:#5aa9ff;color:#fff;border-radius:9px;padding:20px 21px;font-family:'Material Icons Outlined';cursor:pointer;font-size:20px;text-shadow:2px 2px 0 black !important;margin-left:2px";
    button.onclick = openQueueWindow;

    window.openRankedMenu = () => {
        original();
        const footer = document.querySelector(".footer-controls");
        const last = footer?.lastElementChild;
        if (footer && last) footer.insertBefore(button, last);
    };
}
