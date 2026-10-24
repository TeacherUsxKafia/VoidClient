// Menu Timer: shows the match timer while you are in the menu. Style and code in this one file.
import { voidClient } from "../../client.js";

const STYLE_ID = "void_menuTimerCSS";

const CSS = `/* shoutout crankshaft */

#uiBase.onMenu #spectateUI {
	display: block !important;
}

#uiBase.onCompMenu.onMenu #specTimer,
#uiBase.onMenu #specGMessage,
#uiBase.onMenu #spec1,
#uiBase.onMenu #specGameInfo,
#uiBase.onMenu #spec0,
#uiBase.onMenu #specControlHolder,
#uiBase.onMenu #specNames {
	display: none !important;
}

/* direct child selector to beat krunker's .onMenu #spectateUI > div rule */
#uiBase.onMenu #spectateUI > #spectateHUD {
	box-sizing: border-box;
	display: flex !important;
	justify-content: center;
	height: 0.5rem;
	white-space: nowrap;
	width: max-content;
	position: fixed;
	top: calc(50% + 140px);
}
#uiBase.onMenu #spectateHUD #specGMessage {
	top: 0;
}

#uiBase.onMenu #spectateUI > #spectateHUD {
	z-index: 1;
	transform: unset;
}

/* season 10 put the class preview in the center, the gap between logo and spectate toggle is free */
#uiBase.onMenu .spectateInfo {
	position: fixed;
	top: calc(40% - 105px);
	left: 50%;
	transform: translate(-50%, -50%);
}

#uiBase.onMenu #spectateUI div .spectateInfo #specTimer {
	background-color: #00000000;
	padding: 0 25px;
	font-size: 42px;
	border-radius: 0.5em;
}

#uiBase.onMenu #specKPDContr {
	display: none;
}

#uiBase.onMenu #spectateUI div#specStats {
	position: absolute;
	top: calc(50% + 13em);
	left: 50%;
	transform: translateX(-50%);
	z-index: 1;
}

#uiBase.onMenu #spectateUI div#specStats:before {
	content: "Spectating";
	position: absolute;
	bottom: 100%;
	left: 50%;
	transform: translateX(-50%);
	font-size: 1.2em;
	padding-bottom: 0.5em;
}`;

/**
 * @param {boolean} enabled
 */
function toggle(enabled){
    const existing = document.getElementById(STYLE_ID);
    if (!enabled){
        existing?.remove();
        return;
    }
    if (existing) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
}

export default function menuTimer(){
    voidClient.settings.toggleMenuTimer = toggle;
    toggle(voidClient.settings.data.menuTimer !== false);
}
