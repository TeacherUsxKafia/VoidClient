// Better Chat: team and all chat in one view, press Tab to switch where you send. Style and code in this one file.
import { voidClient } from "../../client.js";
import { getElement, getInput } from "../../utils.js";

const CSS = `#chatList > * {
	display: block !important;
}

#chatInputHolder {
	opacity: 1;
	transition:
		opacity 0.2s ease-in-out,
		transform 0.2s ease-in-out;
}

#chatList::-webkit-scrollbar {
	display: none;
}

#chatList {
	transition: margin-bottom 0.2s ease-in-out;
}

#uiBase.onGame #chatList {
	margin-bottom: -50px;
}

#uiBase.onMenu #chatInputHolder {
	transition: none;
}

#uiBase.onGame #chatInputHolder {
	opacity: 0;
	transform: translateY(50px);
}

#uiBase.onGame #chatHolder:focus-within #chatInputHolder {
	opacity: 1;
	transform: translateY(0);
}

#uiBase.onGame #chatHolder:focus-within #chatList {
	margin-bottom: 0;
}

#uiBase.onSpect #chatInputHolder {
	opacity: 1;
	transform: translateY(0);
}

#uiBase.onSpect #chatList {
	margin-bottom: 0;
}`;

class BetterChat {
    constructor(){
        /** @type {Set<string>} */
        this.teamModes = new Set([
            "Team Deathmatch",
            "Hardpoint",
            "Capture the Flag",
            "Hide & Seek",
            "Infected",
            "Last Man Standing",
            "Simon Says",
            "Prop Hunt",
            "Boss Hunt",
            "Deposit",
            "Stalker",
            "Kill Confirmed",
            "Defuse",
            "Traitor",
            "Blitz",
            "Domination",
            "Squad Deathmatch",
            "Team Defender",
        ]);
        /** @type {HTMLStyleElement} */
        this.styles = document.createElement("style");
        this.styles.textContent = CSS;

        voidClient.settings.toggleBetterChat = (enabled) => this.toggle(enabled);

        /** @type {HTMLElement} */
        this.chatHolder = getElement("#chatHolder");
        /** @type {HTMLElement} */
        this.chatList = getElement("#chatList");
        /** @type {HTMLInputElement} */
        this.chatInput = getInput("#chatInput");
        /** @type {HTMLElement} */
        this.chatSwitch = getElement("#chatSwitch");
        /** @type {HTMLDivElement} */
        this.channelT = document.createElement("div");
        /** @type {HTMLDivElement} */
        this.channelA = document.createElement("div");
        this.channelT.style.cssText = "float: left; display: inline-block; margin-right: 5px; color: #9eeb56;";
        this.channelT.textContent = "[T]";
        this.channelA.style.cssText = "float: left; display: inline-block; margin-right: 5px; color: #eb5656;";
        this.channelA.textContent = "[M]";

        /** @type {MutationObserver} */
        this.observer = new MutationObserver((mutations) => this.parseMessages(mutations));
        this.toggle(voidClient.settings.data.betterChat !== false);
    }

    /**
     * @param {KeyboardEvent} event
     */
    switchChat = (event) => {
        if (event.key !== "Tab") return;
        window.switchChat(this.chatSwitch);
        event.preventDefault();
    };

    /**
     * @param {MutationRecord[]} mutations
     */
    parseMessages(mutations){
        let tagged = false;
        for (const mutation of mutations){
            for (const node of mutation.addedNodes){
                // text nodes have no querySelector, a throw kills the whole batch
                if (!(node instanceof HTMLElement)) continue;
                const chatItem = node.querySelector(".chatItem");
                if (!chatItem) continue;
                const chatMsg = chatItem.querySelector(".chatMsg");
                if (!chatMsg) continue;
                if (chatMsg.textContent.includes("Text & Voice Chat")){
                    node.remove();
                    continue;
                }
                // cheap check first, kill feed lines have no tab
                const { tab } = node.dataset;
                if (!tab || !chatItem.textContent.includes("\u200E:") || !this.teamModes.has(window.getGameActivity().mode)) continue;
                if (tab === "0") chatMsg.insertBefore(this.channelA.cloneNode(true), chatMsg.firstChild);
                else if (tab === "1") chatMsg.insertBefore(this.channelT.cloneNode(true), chatMsg.firstChild);
                tagged = true;
            }
        }
        // once per batch, scrollTop forces layout. no scrollHeight read, 1e9 gets clamped
        if (tagged) this.chatList.scrollTop = 1e9;
    }

    /**
     * @param {boolean} enabled
     */
    toggle(enabled){
        if (enabled){
            document.head.append(this.styles);
            this.chatInput.addEventListener("keydown", this.switchChat, { capture: true });
            this.observer.observe(this.chatList, { childList: true });
        }
        else {
            this.styles.remove();
            this.chatInput.removeEventListener("keydown", this.switchChat, { capture: true });
            this.observer.disconnect();
        }
    }
}

export default function betterChat(){
    new BetterChat();
}
