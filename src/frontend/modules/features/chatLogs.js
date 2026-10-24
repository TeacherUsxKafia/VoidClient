// Chat Logs: remembers the last 2000 chat lines (also across lobbies), to search, filter and copy. F1 opens and closes it.
// Change the key with OPEN_KEY below (a KeyboardEvent.code such as "F1" or "KeyL"). Window and code in this one file.
import { voidClient } from "../../client.js";

const OPEN_KEY = "F1";
const OPEN_KEY_NAME = "F1";

const html = `<style>
#clPanel {
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	width: 820px;
	max-width: 92vw;
	height: 640px;
	max-height: 88vh;
	padding: 1.6em 2em 1.2em 2em;
	background: #0d1530;
	color: #fff;
	border-radius: 4px;
	box-shadow: 0 8px 48px #000c;
	font-family: GameFont, sans-serif;
}

#clPanel h2 {
	margin: 0 0 0.6em 0;
	font-size: 1.6em;
	letter-spacing: 1px;
	color: #5aa9ff;
	text-align: center;
}

#clBar {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5em;
	align-items: center;
	margin-bottom: 0.8em;
}

.clFilter,
.clButton {
	padding: 0.45em 0.8em;
	border: 1px solid #2c3c75;
	border-radius: 8px;
	background: #22305f;
	cursor: pointer;
	user-select: none;
}

.clFilter:hover,
.clButton:hover {
	border-color: #5aa9ff;
	color: #5aa9ff;
}

.clFilter.clOn {
	border-color: #5aa9ff;
	background: #17305c;
	color: #5aa9ff;
}

#clFilters {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5em;
}

#clSearch {
	flex: 1;
	min-width: 8em;
	padding: 0.45em 0.8em;
	border: 1px solid #2c3c75;
	border-radius: 8px;
	outline: none;
	background: #0a1128;
	color: #fff;
	font-family: inherit;
	font-size: 1em;
}

#clSearch:focus {
	border-color: #5aa9ff;
}

#clList {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	scrollbar-width: thin;
	scrollbar-color: #444 #0d1530;
	padding: 0.4em 0.6em;
	border-radius: 8px;
	background: #0a1128;
	line-height: 1.5;
	user-select: text;
	cursor: text;
}

.clRow {
	padding: 0.1em 0;
	word-break: break-word;
}

.clTime {
	margin-right: 0.7em;
	color: #666;
}

.clKill {
	color: #aaa;
}

.clEvent {
	color: #f3d08a;
}

.clServer {
	color: #e58cf0;
}

.clLobby {
	margin: 0.5em 0;
	padding-top: 0.3em;
	border-top: 1px solid #22305f;
	color: #5aa9ff;
	font-size: 0.85em;
	letter-spacing: 2px;
	text-transform: uppercase;
	user-select: none;
}

.clEmpty {
	padding: 2em 0;
	color: #777;
	text-align: center;
	user-select: none;
}

#clFoot {
	display: flex;
	gap: 0.7em;
	align-items: center;
	margin-top: 0.9em;
}

#clHint {
	flex: 1;
	color: #777;
	font-size: 0.85em;
}
</style>
<div id="clPanel">
	<h2>Chat Logs</h2>
	<div id="clBar">
		<div id="clFilters"></div>
		<input id="clSearch" type="text" placeholder="Search" autocomplete="off" spellcheck="false">
	</div>
	<div id="clList"></div>
	<div id="clFoot">
		<div id="clHint"></div>
		<div class="clButton" id="clCopy">Copy</div>
		<div class="clButton" id="clClear">Clear</div>
		<div class="clButton" id="clClose">Close</div>
	</div>
</div>
`;

/**
 * Remembers the in-game chat (krunker keeps 35 lines and drops them on every lobby change) and shows it in a window
 * to search, filter and copy.
 */

const MAX_ENTRIES = 2000;
// per tab, so the log follows the player through new lobbies (each one is a page load) but not into another window
const STORE_KEY = "void_chat_logs";
// krunker puts one after every name
const LTR_MARK = String.fromCharCode(0x200e);

/** @typedef {"player"|"kill"|"event"|"server"} Category */
/** @typedef {{t: number, cat: Category|"lobby", text: string}} Entry */

/** @type {[Category, string][]} */
const CATEGORIES = [["player", "Players"], ["kill", "Kills"], ["event", "Events"], ["server", "Server"]];
/** @type {Record<string, string>} */
const ROW_CLASS = { player: "", kill: "clKill", event: "clEvent", server: "clServer", lobby: "clLobby" };

/**
 * one line of #chatList, see the chat code in the game: kill feed lines have no data-tab, a player line has the
 * name in front of .chatMsg, notices color .chatMsg (#fc03ec by default), streaks and unboxes leave it plain
 *
 * @param {HTMLElement} node
 * @return {Category}
 */
function classify(node){
    if (!node.hasAttribute("data-tab")) return "kill";
    const item = node.querySelector(".chatItem");
    const msg = item?.querySelector(".chatMsg");
    if (!item || !(msg instanceof HTMLElement) || item.querySelector(".tradeMsg")) return "event";
    if (item.firstChild !== msg) return "player";
    return msg.style.color ? "server" : "event";
}

/**
 * kill lines carry the weapon, headshot and wallbang as images between the names
 *
 * @param {HTMLElement} node
 * @return {string}
 */
function killText(node){
    let text = "";
    let weapon = false;
    /** @type {string[]} */
    const tags = [];
    for (const part of node.querySelector(".chatMsg")?.childNodes ?? []){
        if (!(part instanceof HTMLImageElement)){
            text += part.textContent ?? "";
            continue;
        }
        const src = part.getAttribute("src") ?? "";
        if (src.includes("headshot")) tags.push("headshot");
        else if (src.includes("wallbang")) tags.push("wallbang");
        else if (!weapon){
            weapon = true;
            text += " ▸ ";
        }
    }
    return tags.length > 0 ? `${text.trim()} (${tags.join(", ")})` : text;
}

/**
 * @param {number} time
 * @return {string}
 */
function clock(time){
    const date = new Date(time);
    return [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, "0")).join(":");
}

/**
 * @return {Entry[]}
 */
function restore(){
    try {
        const stored = JSON.parse(window.sessionStorage.getItem(STORE_KEY) ?? "[]");
        return Array.isArray(stored) ? stored.slice(-MAX_ENTRIES) : [];
    }
    catch {
        return [];
    }
}

/**
 * @return {string}
 */
function lobbyName(){
    try {
        const { mode, map } = window.getGameActivity();
        if (mode && map) return `${mode} on ${map}`;
    }
    catch {
        // no game yet
    }
    return "New lobby";
}

class ChatLogs {
    constructor(){
        /** @type {Entry[]} */
        this.entries = restore();
        if (this.entries.length > 0 && this.entries[this.entries.length - 1].cat !== "lobby") this.entries.push({ t: Date.now(), cat: "lobby", text: lobbyName() });
        /** @type {Set<Category>} empty shows everything */
        this.shown = new Set();
        /** @type {{overlay: HTMLDivElement, shadow: ShadowRoot, list: HTMLElement, search: HTMLInputElement}|null} */
        this.view = null;
        // follow new lines only while the player sits at the bottom
        this.stick = true;
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) for (const node of mutation.addedNodes) this.add(node);
        });
        this.save = () => {
            try {
                window.sessionStorage.setItem(STORE_KEY, JSON.stringify(this.entries));
            }
            catch {
                // storage full or blocked, the log just starts over
            }
        };

        voidClient.chatLogs = { open: () => this.open(), toggle: () => this.toggle() };
        voidClient.settings.toggleChatLogs = (enabled) => this.setEnabled(enabled);
        this.setEnabled(voidClient.settings.data.chatLogs !== false);
    }

    /**
     * @param {boolean} enabled
     */
    setEnabled(enabled){
        this.observer.disconnect();
        window.removeEventListener("pagehide", this.save);
        if (!enabled){
            this.close();
            return;
        }
        const chatList = document.getElementById("chatList");
        if (!chatList) return;
        // lines that came before this module, the welcome message
        for (const node of chatList.children) this.add(node);
        this.observer.observe(chatList, { childList: true });
        window.addEventListener("pagehide", this.save);
    }

    /**
     * @param {Node} node
     */
    add(node){
        if (!(node instanceof HTMLElement)) return;
        const cat = classify(node);
        const text = (cat === "kill" ? killText(node) : node.textContent ?? "").replaceAll(LTR_MARK, "").trim();
        if (!text) return;
        /** @type {Entry} */
        const entry = { t: Date.now(), cat, text };
        this.entries.push(entry);
        if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
        if (!this.view || !this.visible(entry)) return;
        const { list } = this.view;
        list.querySelector(".clEmpty")?.remove();
        list.append(this.row(entry));
        if (list.childElementCount > MAX_ENTRIES) list.firstElementChild?.remove();
        // no scrollHeight read, 1e9 gets clamped
        if (this.stick) list.scrollTop = 1e9;
    }

    /**
     * @param {Entry} entry
     * @return {boolean}
     */
    visible(entry){
        const query = this.view?.search.value.trim().toLowerCase() ?? "";
        if (entry.cat === "lobby") return this.shown.size === 0 && !query;
        if (this.shown.size > 0 && !this.shown.has(entry.cat)) return false;
        return !query || entry.text.toLowerCase().includes(query);
    }

    /**
     * @param {Entry} entry
     * @return {HTMLDivElement}
     */
    row(entry){
        const row = document.createElement("div");
        row.className = `clRow ${ROW_CLASS[entry.cat] ?? ""}`;
        const time = document.createElement("span");
        time.className = "clTime";
        time.textContent = clock(entry.t);
        row.append(time, entry.text);
        return row;
    }

    render(){
        if (!this.view) return;
        const rows = this.entries.filter((entry) => this.visible(entry)).map((entry) => this.row(entry));
        if (rows.length === 0){
            const empty = document.createElement("div");
            empty.className = "clEmpty";
            empty.textContent = this.entries.length === 0 ? "Nothing in the chat yet" : "No line matches";
            rows.push(empty);
        }
        this.view.list.replaceChildren(...rows);
        this.view.list.scrollTop = 1e9;
        this.stick = true;
        this.renderFilters();
    }

    renderFilters(){
        if (!this.view) return;
        /**
         * @param {string} label
         * @param {boolean} on
         * @param {() => void} onClick
         * @return {HTMLDivElement}
         */
        const button = (label, on, onClick) => {
            const element = document.createElement("div");
            element.className = `clFilter${on ? " clOn" : ""}`;
            element.textContent = label;
            element.onclick = onClick;
            return element;
        };
        const all = button("All", this.shown.size === 0, () => {
            this.shown.clear();
            this.render();
        });
        const filters = CATEGORIES.map(([cat, label]) => button(label, this.shown.has(cat), () => {
            if (this.shown.has(cat)) this.shown.delete(cat);
            else this.shown.add(cat);
            this.render();
        }));
        /** @type {HTMLElement} */ (this.view.shadow.querySelector("#clFilters")).replaceChildren(all, ...filters);
    }

    open(){
        if (this.view) return;
        if (document.pointerLockElement) document.exitPointerLock();
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;justify-content:center;align-items:center;background:rgba(0,0,0,0.75)";
        const host = document.createElement("div");
        overlay.append(host);
        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = html;
        /**
         * @param {string} id
         * @return {HTMLElement}
         */
        const element = (id) => /** @type {HTMLElement} */ (shadow.querySelector(`#${id}`));
        const list = element("clList");
        const search = /** @type {HTMLInputElement} */ (element("clSearch"));
        this.view = { overlay, shadow, list, search };

        element("clHint").textContent = `${OPEN_KEY_NAME} opens and closes this. Select lines and copy with Ctrl+C`;
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) this.close();
        });
        // the game reads keys on window, typing a search must not move or reload
        for (const type of ["keydown", "keyup", "keypress"]){
            host.addEventListener(type, (event) => {
                const key = /** @type {KeyboardEvent} */ (event);
                // the hotkey listener skips keys while the search has focus
                if (type === "keydown" && !key.repeat && (key.key === "Escape" || key.code === OPEN_KEY)) this.close();
                event.stopPropagation();
            });
        }
        list.addEventListener("scroll", () => {
            this.stick = list.scrollTop + list.clientHeight >= list.scrollHeight - 30;
        }, { passive: true });
        search.addEventListener("input", () => this.render());
        element("clCopy").onclick = () => {
            const text = this.entries.filter((entry) => this.visible(entry)).map((entry) => `${clock(entry.t)} ${entry.text}`).join("\n");
            navigator.clipboard.writeText(text).then(
                () => voidClient.showNotification("Chat log copied", false, 2),
                () => voidClient.showNotification("Could not copy the chat log", false, 3),
            );
        };
        element("clClear").onclick = () => {
            this.entries = [];
            this.save();
            this.render();
        };
        element("clClose").onclick = () => this.close();

        document.body.append(overlay);
        this.render();
        search.focus();
    }

    close(){
        this.view?.overlay.remove();
        this.view = null;
    }

    toggle(){
        if (this.view) this.close();
        else this.open();
    }
}

export default function chatLogs(){
    const logs = new ChatLogs();
    (voidClient.hotkeyHints ??= []).push({ source: "Chat Logs", label: "Open chat logs", key: OPEN_KEY_NAME });
    window.addEventListener("keydown", (event) => {
        if (event.code !== OPEN_KEY || event.repeat || event.ctrlKey || event.altKey || event.shiftKey) return;
        if (voidClient.settings.data.chatLogs === false) return;
        event.preventDefault();
        logs.toggle();
    });
}
